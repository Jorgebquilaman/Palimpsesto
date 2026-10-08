using Dapper;
using Digesto.Application.Busquedas;
using Microsoft.EntityFrameworkCore;

namespace Digesto.Infrastructure.Busquedas;

public class PalabrasClaveNormas : IPalabrasClaveNormas
{
    private readonly DbContextOptions<Persistencia.DigestoDbContext> _opciones;

    public PalabrasClaveNormas(DbContextOptions<Persistencia.DigestoDbContext> opciones)
    {
        _opciones = opciones;
    }

    public async Task<ResultadoPalabrasClave> AgregarAsync(
        int? tipoId,
        int? organoId,
        DateOnly? desde,
        DateOnly? hasta,
        short? anio,
        Domain.Enums.Vigencia? vigencia,
        string? q,
        int limite = 60,
        int offset = 0,
        CancellationToken ct = default)
    {
        await using var db = new Persistencia.DigestoDbContext(_opciones);
        var con = (Npgsql.NpgsqlConnection)db.Database.GetDbConnection();
        await con.OpenAsync(ct);

        var p = new DynamicParameters();
        var where = """
            n.visibilidad = 1
            AND n.estado_publicacion IN (4, 5)
            AND p.palabra <> ''
            """;

        if (tipoId is not null)
        {
            where += "\n  AND n.tipo_norma_id = @tipoId";
            p.Add("@tipoId", tipoId);
        }
        if (organoId is not null)
        {
            where += "\n  AND n.organo_emisor_id = @organoId";
            p.Add("@organoId", organoId);
        }
        if (desde is not null)
        {
            where += "\n  AND n.fecha_sancion >= @desde";
            p.Add("@desde", desde.Value.ToDateTime(TimeOnly.MinValue));
        }
        if (hasta is not null)
        {
            where += "\n  AND n.fecha_sancion <= @hasta";
            p.Add("@hasta", hasta.Value.ToDateTime(TimeOnly.MaxValue));
        }
        if (anio is not null)
        {
            where += "\n  AND n.anio = @anio";
            p.Add("@anio", anio);
        }
        if (vigencia is not null)
        {
            where += "\n  AND n.vigencia = @vigencia";
            p.Add("@vigencia", (int)vigencia);
        }

        var with = "";
        if (!string.IsNullOrWhiteSpace(q))
        {
            p.Add("@q", q.Trim());
            with = """
                WITH candidatos AS (
                    SELECT n.id
                    FROM norma n, (SELECT websearch_to_tsquery('spanish', f_unaccent(@q)) AS tsq) q
                    WHERE n.tsv_meta @@ q.tsq
                    UNION
                    SELECT f.norma_id
                    FROM norma_fragmento f, (SELECT websearch_to_tsquery('spanish', f_unaccent(@q)) AS tsq) q
                    WHERE f.tsv_es @@ q.tsq
                )
                """;
            where += "\n  AND n.id IN (SELECT id FROM candidatos)";
        }

        var pedido = Math.Clamp(limite, 1, 200);
        p.Add("@limit", pedido + 1);
        p.Add("@offset", Math.Max(0, offset));

        var sql = $"""
            {with}
            SELECT p.palabra, count(*) AS cantidad
            FROM norma n
            CROSS JOIN LATERAL (SELECT unnest(n.palabras_clave) AS palabra) p
            WHERE {where}
            GROUP BY p.palabra
            ORDER BY cantidad DESC, p.palabra ASC
            LIMIT @limit OFFSET @offset
            """;

        var filas = (await con.QueryAsync<(string palabra, long cantidad)>(sql, p)).ToList();
        var palabras = filas
            .Take(pedido)
            .Select(f => new PalabraClaveConteo(f.palabra, (int)f.cantidad))
            .ToList();
        return new ResultadoPalabrasClave(palabras, filas.Count > pedido);
    }
}
