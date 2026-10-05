using System.Text.Json;
using Digesto.Application.Ai;
using Digesto.Application.Archivos;
using Microsoft.EntityFrameworkCore;

namespace Digesto.Infrastructure.Ai;

public class ConfiguracionAiEf : IConfiguracionAi
{
    private readonly Persistencia.DigestoDbContext _db;

    public ConfiguracionAiEf(Persistencia.DigestoDbContext db)
    {
        _db = db;
    }

    private const string ClaveConfig = "deepseek";

    public async Task<ConfiguracionAi?> LeerAsync(CancellationToken ct = default)
    {
        var registro = await _db.Configuracion.FindAsync(new object[] { ClaveConfig }, ct);
        if (registro is null)
        {
            var env = Environment.GetEnvironmentVariable("DEEPSEEK_API_KEY");
            if (string.IsNullOrEmpty(env))
            {
                return null;
            }
            return new ConfiguracionAi(env, "deepseek-chat", "https://api.deepseek.com");
        }

        var datos = JsonSerializer.Deserialize<DatosGuardados>(registro.Valor);
        return datos is null ? null : new ConfiguracionAi(datos.clave_api, datos.modelo ?? "deepseek-chat", datos.base_url ?? "https://api.deepseek.com");
    }

    public async Task GuardarAsync(ConfiguracionAi configuracion, CancellationToken ct = default)
    {
        var json = JsonSerializer.Serialize(new DatosGuardados(
            configuracion.ClaveApi ?? "",
            configuracion.Modelo,
            configuracion.BaseUrl));

        var registro = await _db.Configuracion.FindAsync(new object[] { ClaveConfig }, ct);
        if (registro is null)
        {
            _db.Configuracion.Add(new Domain.Entidades.Configuracion
            {
                Clave = ClaveConfig,
                Valor = json,
                ActualizadoEn = DateTime.UtcNow,
            });
        }
        else
        {
            registro.Valor = json;
            registro.ActualizadoEn = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync(ct);
    }

    private record DatosGuardados(string clave_api, string? modelo, string? base_url);
}
