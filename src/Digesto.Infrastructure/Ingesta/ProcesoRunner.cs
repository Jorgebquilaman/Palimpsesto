using System.Diagnostics;
using Digesto.Application.Ingesta;

namespace Digesto.Infrastructure.Ingesta;

public class ProcesoRunner : IProcesoRunner
{
    public async Task<ResultadoProceso> EjecutarAsync(string programa, string[] argumentos, TimeSpan timeout, CancellationToken ct = default)
    {
        var psi = new ProcessStartInfo
        {
            FileName = programa,
            Arguments = string.Join(' ', argumentos.Select(Quote)),
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        using var proceso = new Process { StartInfo = psi };

        if (!proceso.Start())
        {
            return new ResultadoProceso(-1, "", $"No se pudo iniciar {programa}");
        }

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(timeout);

        var salidaTask = proceso.StandardOutput.ReadToEndAsync(ct);
        var errorTask = proceso.StandardError.ReadToEndAsync(ct);

        try
        {
            await proceso.WaitForExitAsync(cts.Token);
        }
        catch (OperationCanceledException)
        {
            try
            {
                proceso.Kill(entireProcessTree: true);
            }
            catch
            {
            }
            return new ResultadoProceso(-2, "", $"Timeout de proceso {programa} ({timeout.TotalSeconds}s)");
        }

        var salida = await salidaTask;
        var error = await errorTask;
        return new ResultadoProceso(proceso.ExitCode, salida, error);
    }

    private static string Quote(string argumento)
    {
        if (string.IsNullOrEmpty(argumento))
        {
            return "\"\"";
        }
        if (argumento.Contains(' ') || argumento.Contains('"') || argumento.Contains('\''))
        {
            return '"' + argumento.Replace("\"", "\\\"") + '"';
        }
        return argumento;
    }
}
