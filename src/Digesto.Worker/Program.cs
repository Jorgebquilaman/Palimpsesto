using Digesto.Domain.Enums;
using Digesto.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = Host.CreateApplicationBuilder(args);

    builder.Services.AddSerilog((services, configuration) => configuration
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

    builder.Services.AddHostedService<IngestaWorker>();

    var host = builder.Build();
    host.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "El worker terminó inesperadamente");
}
finally
{
    Log.CloseAndFlush();
}

public class IngestaWorker : BackgroundService
{
    private readonly ILogger<IngestaWorker> _logger;
    private readonly IServiceProvider _services;

    public IngestaWorker(ILogger<IngestaWorker> logger, IServiceProvider services)
    {
        _logger = logger;
        _services = services;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Worker de ingesta iniciado");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var ids = await ReclamarPendientesAsync(stoppingToken);
                if (ids.Count == 0)
                {
                    await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
                    continue;
                }

                await using var scope = _services.CreateAsyncScope();
                var pipeline = scope.ServiceProvider.GetRequiredService<Digesto.Infrastructure.Ingesta.PipelineIngesta>();
                foreach (var id in ids)
                {
                    await pipeline.ProcesarAsync(id, stoppingToken);
                }
            }
            catch (OperationCanceledException)
            {
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en el loop del worker");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    private async Task<List<long>> ReclamarPendientesAsync(CancellationToken ct)
    {
        await using var scope = _services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<Digesto.Infrastructure.Persistencia.DigestoDbContext>();

        var ids = (await db.Database.SqlQuery<long>($"""
            UPDATE proceso_ingesta
            SET estado = {(int)EstadoProceso.EnCurso}::int, locked_at = now()
            WHERE id IN (
                SELECT id FROM proceso_ingesta
                WHERE estado = {(int)EstadoProceso.Pendiente}::int
                ORDER BY id
                LIMIT 20
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id AS "Value"
            """).ToListAsync(ct));
        return ids;
    }
}
