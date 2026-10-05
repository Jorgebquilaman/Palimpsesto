using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Digesto.Api.Controllers;

[ApiController]
[Route("api/v1/admin/estadisticas")]
[Authorize(Roles = "admin,editor")]
public class EstadisticasController : ControllerBase
{
    private readonly Npgsql.NpgsqlDataSource _fuente;

    public EstadisticasController(IConfiguration configuracion)
    {
        var cadena = configuracion.GetConnectionString("Digesto")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings__Digesto")
            ?? "Host=localhost;Port=5433;Database=digesto;Username=digesto;Password=digesto_dev";
        _fuente = Npgsql.NpgsqlDataSource.Create(cadena);
    }

    [HttpGet("busquedas")]
    public async Task<IActionResult> Busquedas(CancellationToken ct)
    {
        await using var con = await _fuente.OpenConnectionAsync(ct);

        const string sqlPopulares = """
            SELECT coalesce(q, '(sin texto)') AS consulta, count(*) AS veces, round(avg(ms)) AS promedio_ms
            FROM consulta_busqueda
            WHERE fecha >= now() - interval '30 days'
            GROUP BY 1
            ORDER BY veces DESC
            LIMIT 20
            """;

        const string sqlSinResultados = """
            SELECT q, count(*) AS veces
            FROM consulta_busqueda
            WHERE fecha >= now() - interval '30 days' AND total = 0 AND q IS NOT NULL AND length(trim(q)) > 0
            GROUP BY q
            ORDER BY veces DESC
            LIMIT 20
            """;

        var populares = (await con.QueryAsync(sqlPopulares)).Select(f => new
        {
            consulta = (string)f.consulta,
            veces = (int)f.veces,
            promedioMs = (int)f.promedio_ms,
        });

        var sinResultados = (await con.QueryAsync(sqlSinResultados)).Select(f => new
        {
            consulta = (string)f.q,
            veces = (int)f.veces,
        });

        return Ok(new { populares, sinResultados });
    }
}
