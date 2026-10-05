using Digesto.Application.Archivos;
using Digesto.Infrastructure.Archivos;
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

        return services;
    }
}
