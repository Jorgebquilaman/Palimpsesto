using System.Text;
using System.Text.Json.Serialization;
using Digesto.Application.Archivos;
using Digesto.Infrastructure;
using Digesto.Infrastructure.Archivos;
using Digesto.Infrastructure.Auth;
using Digesto.Infrastructure.Persistencia;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog((context, services, configuration) => configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()
        .WriteTo.Console());

    var cadenaConexion =
        builder.Configuration.GetConnectionString("Digesto")
        ?? Environment.GetEnvironmentVariable("ConnectionStrings__Digesto")
        ?? "Host=localhost;Port=5433;Database=digesto;Username=digesto;Password=digesto_dev";

    builder.Services.AddDigestoInfrastructure(
        cadenaConexion,
        Environment.GetEnvironmentVariable("FileStorage__Root")
            ?? builder.Configuration["FileStorage:Root"]
            ?? Environment.GetEnvironmentVariable("FILE_STORAGE_ROOT"));

    builder.Services.AddIdentityCore<UsuarioApp>()
        .AddRoles<IdentityRole>()
        .AddEntityFrameworkStores<DigestoDbContext>()
        .AddDefaultTokenProviders()
        .AddSignInManager<SignInManager<UsuarioApp>>();

    builder.Services.AddAuthorization();

    builder.Services.Configure<Digesto.Infrastructure.Auth.TokenOptions>(options =>
    {
        options.Clave = builder.Configuration["Jwt:Clave"]
            ?? Environment.GetEnvironmentVariable("Jwt__Clave")
            ?? "clave_de_desarrollo_solo_para_local_minimo_32_caracteres";
    });

    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            var clave = builder.Configuration["Jwt:Clave"]
                ?? Environment.GetEnvironmentVariable("Jwt__Clave")
                ?? "clave_de_desarrollo_solo_para_local_minimo_32_caracteres";
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = builder.Configuration["Jwt:Emisor"] ?? "digesto-iupa",
                ValidAudience = builder.Configuration["Jwt:Publico"] ?? "digesto-iupa",
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(clave)),
            };
        });
    builder.Services.AddAuthorization();

    builder.Services.AddControllers().AddJsonOptions(o =>
    o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen();
    builder.Services.AddHealthChecks()
        .AddNpgSql(cadenaConexion, tags: new[] { "db" });

    builder.Services.Configure<Digesto.Infrastructure.Ingesta.IngestaOpciones>(
        builder.Configuration.GetSection("Ingesta"));

    builder.Services.AddScoped<TokenGenerator>();

    var app = builder.Build();

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
    }

    app.UseSerilogRequestLogging();

    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<DigestoDbContext>();
        await db.Database.MigrateAsync();
        await scope.ServiceProvider.GetRequiredService<SeedDigesto>().EjecutarAsync();
    }

    app.UseAuthentication();
    app.UseAuthorization();
    app.MapControllers();
    app.MapHealthChecks("/health");

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "La API terminó inesperadamente");
}
finally
{
    Log.CloseAndFlush();
}

public partial class Program
{
}
