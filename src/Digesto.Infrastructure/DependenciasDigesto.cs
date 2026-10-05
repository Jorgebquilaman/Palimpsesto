using Digesto.Application.Archivos;
using Digesto.Application.Ingesta;
using Digesto.Infrastructure.Archivos;
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

        services.AddSingleton<IFileStorage>(new FileStorageLocal(
            raizArchivos ?? Path.Combine(AppContext.BaseDirectory, "archivos")));

        services.AddScoped<SeedDigesto>();

        services.AddSingleton<IngestaOpciones>();
        services.AddSingleton<IProcesoRunner, ProcesoRunner>();
        services.AddSingleton<IPdfTools, PopplerPdfTools>();
        services.AddSingleton<IEstructurador, EstructuradorRegex>();
        services.AddSingleton<IExtractorMetadatos, ExtractorMetadatosHeuristico>();
        services.AddSingleton<ISanitizadorHtml, SanitizadorHtml>();
        services.AddScoped<Application.Ingesta.IIngestaService, IngestaService>();
        services.AddScoped<PipelineIngesta>();

        return services;
    }
}
