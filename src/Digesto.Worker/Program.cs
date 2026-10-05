using Digesto.Domain.Enums;
using Digesto.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
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
        builder.Configuration["FileStorage:Root"]
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
                var procesados = await ProcesarPendientesAsync(stoppingToken);
                if (procesados == 0)
                {
                    await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
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

    private async Task<int> ProcesarPendientesAsync(CancellationToken ct)
    {
        await using var scope = _services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<Digesto.Infrastructure.Persistencia.DigestoDbContext>();

        await using var transaccion = await db.Database.BeginTransactionAsync(ct);

        var pendientes = await db.ProcesosIngesta
            .Where(p => p.Estado == EstadoProceso.Pendiente)
            .OrderBy(p => p.Id)
            .ToListAsync(ct);

        foreach (var proceso in pendientes)
        {
            proceso.Estado = EstadoProceso.EnCurso;
            proceso.Etapa = "validar";
            proceso.LockedAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync(ct);
        await transaccion.CommitAsync(ct);

        _logger.LogInformation("Worker: {Cantidad} procesos marcados en curso (procesamiento real en hito 2)", pendientes.Count);
        return pendientes.Count;
    }
}
