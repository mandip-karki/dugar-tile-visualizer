using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

const string DevCorsPolicy = "AngularDev";
builder.Services.AddCors(options =>
{
    options.AddPolicy(DevCorsPolicy, policy =>
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod());
});
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseCors(DevCorsPolicy);
}

app.UseHttpsRedirection();

var assetsRoot = Path.Combine(app.Environment.ContentRootPath, "..", "tile-assets");
var tilesJsonPath = Path.Combine(assetsRoot, "tiles.json");
var imagesRoot = Path.Combine(assetsRoot, "images");

var contentTypeProvider = new FileExtensionContentTypeProvider();
contentTypeProvider.Mappings[".webp"] = "image/webp";

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(imagesRoot),
    RequestPath = "/images",
    ContentTypeProvider = contentTypeProvider
});

var jsonOptions = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

app.MapGet("/api/tiles", (string? usage, string? category, string? size) =>
{
    var json = File.ReadAllText(tilesJsonPath);
    var tiles = JsonSerializer.Deserialize<List<TileRecord>>(json, jsonOptions) ?? [];

    var filtered = tiles.Where(t =>
        (usage is null || string.Equals(t.Usage, usage, StringComparison.OrdinalIgnoreCase)) &&
        (category is null || string.Equals(t.Category, category, StringComparison.OrdinalIgnoreCase)) &&
        (size is null || string.Equals(t.Size, size, StringComparison.OrdinalIgnoreCase)));

    return Results.Json(filtered);
})
.WithName("GetTiles");

app.Run();

record TileRecord(
    string Id,
    string Name,
    string Size,
    string? Surface,
    string Category,
    string Usage,
    [property: JsonPropertyName("sourcePage")] int SourcePage,
    [property: JsonPropertyName("nativeWidth")] int NativeWidth,
    [property: JsonPropertyName("nativeHeight")] int NativeHeight,
    [property: JsonPropertyName("fullImage")] string FullImage,
    [property: JsonPropertyName("thumbImage")] string ThumbImage,
    [property: JsonPropertyName("nameSource")] string NameSource
);
