using Digesto.Application.Archivos;
using Digesto.Application.Busquedas;
using Digesto.Application.Ingesta;
using Digesto.Infrastructure.Archivos;
using Digesto.Infrastructure.Busquedas;
using Digesto.Infrastructure.Ingesta;
using Digesto.Infrastructure.Persistencia;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Digesto.Infrastructure;

public static class DependenciasDigesto
{
    public static IServiceCollection AddDigestoInfrastructure(
        this IServiceCollection services,
        string cadenaConexion,
        string? raizArchivos)
    {
        services.AddDbContext<DigestoDbContext>(options =>
            options.UseNpgsql(cadenaConexion)
                .UseSnakeCaseNamingConvention());

        if (string.IsNullOrWhiteSpace(raizArchivos))
        {
            raizArchivos = Path.Combine(Directory.GetCurrentDirectory(), "archivos");
        }
        services.AddSingleton<IFileStorage>(new FileStorageLocal(raizArchivos.Trim()));

        services.AddScoped<SeedDigesto>();

        services.AddSingleton<IngestaOpciones>();
        services.AddSingleton<IProcesoRunner, ProcesoRunner>();
        services.AddSingleton<IPdfTools, PopplerPdfTools>();
        services.AddSingleton<IEstructurador, EstructuradorRegex>();
        services.AddSingleton<IExtractorMetadatos, ExtractorMetadatosHeuristico>();
        services.AddSingleton<ISanitizadorHtml, SanitizadorHtml>();
        services.AddSingleton<IOcrServicio, OcrmypdfServicio>();
        services.AddSingleton<Application.Ingesta.IImportadorCsv, ImportadorCsv>();
        services.AddScoped<Application.Ingesta.IIngestaService, IngestaService>();
        services.AddScoped<PipelineIngesta>();
        services.AddScoped<Application.Busquedas.IBuscadorNormas, BuscadorNormas>();
        services.AddScoped<Application.Busquedas.ISugerenciasNormas, SugerenciasNormas>();

        return services;
    }
}
