using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddHttpClient();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("AllowFrontend");

app.MapGet("/api/sol/metricas-dm", async (IHttpClientFactory httpClientFactory) =>
{
    const string sourceUrl = "https://solapp.arsa.hn/api/Reportes/dm-tramites-fase-tecnica";
    var localJsonPath = Path.GetFullPath(Path.Combine(
        app.Environment.ContentRootPath,
        "..",
        "..",
        "Json api",
        "metricas-ugc.customization"));
    var localTrazabilidadPath = Path.GetFullPath(Path.Combine(
        app.Environment.ContentRootPath,
        "..",
        "..",
        "Json api",
        "trasabilidad-tramites.customization"));
    var useLocalJson = string.Equals(
        Environment.GetEnvironmentVariable("SOL_USE_LOCAL_JSON"),
        "true",
        StringComparison.OrdinalIgnoreCase);
    var httpClient = httpClientFactory.CreateClient();
    httpClient.Timeout = TimeSpan.FromSeconds(240);

    try
    {
        if (useLocalJson)
        {
            var localContent = await File.ReadAllTextAsync(localJsonPath);
            var localData = JsonSerializer.Deserialize<JsonElement>(localContent);
            JsonElement? trazabilidadData = null;

            if (File.Exists(localTrazabilidadPath))
            {
                var trazabilidadContent = await File.ReadAllTextAsync(localTrazabilidadPath);
                trazabilidadData = JsonSerializer.Deserialize<JsonElement>(trazabilidadContent);
            }

            return Results.Json(new
            {
                sourceUrl = localJsonPath,
                apiSourceUrl = sourceUrl,
                statusHttp = 200,
                ok = true,
                source = "JSON LOCAL",
                sourceKind = "JSON_LOCAL",
                fileName = Path.GetFileName(localJsonPath),
                trazabilidadFileName = Path.GetFileName(localTrazabilidadPath),
                data = localData,
                trazabilidadData,
                raw = (string?)null,
                parseError = (string?)null
            });
        }

        using var response = await httpClient.GetAsync(sourceUrl);
        var content = await response.Content.ReadAsStringAsync();

        JsonElement? data = null;
        string? parseError = null;

        try
        {
            data = JsonSerializer.Deserialize<JsonElement>(content);
        }
        catch (JsonException ex)
        {
            parseError = ex.Message;
        }

        return Results.Json(new
        {
            sourceUrl,
            statusHttp = (int)response.StatusCode,
            ok = response.IsSuccessStatusCode,
            source = "API SOL",
            sourceKind = "API_SOL",
            data,
            raw = data.HasValue ? null : content,
            parseError
        });
    }
    catch (Exception ex)
    {
        return Results.Json(new
        {
            sourceUrl,
            statusHttp = 502,
            ok = false,
            source = "API SOL",
            sourceKind = "API_SOL",
            data = (JsonElement?)null,
            raw = (string?)null,
            parseError = ex.Message
        }, statusCode: 502);
    }
})
.WithName("GetSolMetricasDm");

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
