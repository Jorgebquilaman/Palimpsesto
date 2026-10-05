using Dapper;
using Digesto.Application.Busquedas;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Digesto.Infrastructure.Busquedas;

public class BuscadorNormas : IBuscadorNormas
{
    private readonly DbContextOptions<Persistencia.DigestoDbContext> _opciones;
    private readonly ILogger<BuscadorNormas> _logger;

    public BuscadorNormas(DbContextOptions<Persistencia.DigestoDbContext> opciones, ILogger<BuscadorNormas> logger)
    {
        _opciones = opciones;
        _logger = logger;
    }

    public async Task<ResultadoBusqueda> BuscarAsync(FiltrosBusqueda filtros, CancellationToken ct = default)
    {
        var reloj = System.Diagnostics.Stopwatch.StartNew();

        await using var db = new Persistencia.DigestoDbContext(_opciones);
        var con = (Npgsql.NpgsqlConnection)db.Database.GetDbConnection();
        await con.OpenAsync(ct);

        var cita = CitaNormaParser.Parsear(filtros.Q);
        if (cita is not null)
        {
            var directa = await BuscarPorCitaDirectaAsync(con, cita, ct);
            if (directa is not null)
            {
                reloj.Stop();
                return new ResultadoBusqueda(
                    [directa],
                    new Facetas([], [], [], []),
                    1,
                    reloj.ElapsedMilliseconds,
                    directa.Codigo);
            }
        }

        var (with, where, rankingJoin, parametros) = ConstruirNucleo(filtros);

        var rankColumn = string.IsNullOrWhiteSpace(filtros.Q) ? "NULL::double precision" : "ranking.rank";

        var sql = $"""
            {with}
            SELECT count(*) OVER () AS total,
                   n.id, n.codigo_normalizado, n.titulo, n.numero, n.anio,
                   n.fecha_sancion, n.fecha_publicacion, n.vigencia, n.texto_origen,
                   {rankColumn},
                   tn.codigo AS tipo_codigo, tn.nombre AS tipo_nombre,
                   oe.nombre AS organo_nombre
            FROM norma n
            JOIN tipo_norma tn ON tn.id = n.tipo_norma_id
            JOIN organo_emisor oe ON oe.id = n.organo_emisor_id
            {rankingJoin}
            WHERE {where}
            ORDER BY {ConstruirOrden(filtros)}
            LIMIT @limit OFFSET @offset
            """;

        var filas = (await con.QueryAsync(sql, parametros)).ToList();
        var total = filas.Count == 0 ? 0 : (int)filas[0].total;

        var items = filas.Select(FilaAItem).ToList();

        if (items.Count > 0 && !string.IsNullOrWhiteSpace(filtros.Q))
        {
            await CompletarSnippetsAsync(con, filtros, items, ct);
        }

        var facetas = await CalcularFacetasAsync(con, filtros, ct);

        reloj.Stop();
        return new ResultadoBusqueda(items, facetas, total, reloj.ElapsedMilliseconds, null);
    }

    private static ItemResultado FilaAItem(dynamic f) => new()
    {
        Id = (Guid)f.id,
        Codigo = (string)f.codigo_normalizado,
        TipoCodigo = (string)f.tipo_codigo,
        TipoNombre = (string)f.tipo_nombre,
        OrganoNombre = (string)f.organo_nombre,
        Numero = (int)f.numero,
        Anio = (short)f.anio,
        Titulo = (string)f.titulo,
        FechaSancion = DateOnly.FromDateTime((DateTime)f.fecha_sancion),
        FechaPublicacion = f.fecha_publicacion is null ? null : DateOnly.FromDateTime((DateTime)f.fecha_publicacion),
        Vigencia = ((Domain.Enums.Vigencia)(int)f.vigencia).ToString().ToLowerInvariant(),
        TieneOcr = (int)f.texto_origen == (int)Domain.Enums.TextoOrigen.Ocr,
    };

    private async Task<ItemResultado?> BuscarPorCitaDirectaAsync(Npgsql.NpgsqlConnection con, CitaDetectada cita, CancellationToken ct)
    {
        var sql = """
            SELECT n.id, n.codigo_normalizado, n.titulo, n.numero, n.anio, n.fecha_sancion, n.fecha_publicacion, n.vigencia, n.texto_origen,
                   tn.codigo AS tipo_codigo, tn.nombre AS tipo_nombre, oe.nombre AS organo_nombre
            FROM norma n
            JOIN tipo_norma tn ON tn.id = n.tipo_norma_id
            JOIN organo_emisor oe ON oe.id = n.organo_emisor_id
            WHERE n.visibilidad = 1
              AND n.estado_publicacion IN (4, 5)
              AND tn.codigo = @tipo
              AND n.numero = @numero
              AND n.anio = @anio
            ORDER BY n.fecha_sancion DESC
            LIMIT 1
            """;

        var fila = await con.QueryFirstOrDefaultAsync(sql, new { tipo = cita.TipoCodigo, numero = cita.Numero, anio = cita.Anio });
        if (fila is null)
        {
            return null;
        }

        return FilaAItem(fila);
    }

    private static string CteCandidatos(ModoBusqueda modo)
    {
        return modo switch
        {
            ModoBusqueda.Todas => """
                WITH candidatos AS (
                    SELECT n.id, ts_rank_cd(n.tsv_meta, q.tsq, 32) AS rank
                    FROM norma n, (SELECT websearch_to_tsquery('spanish', f_unaccent(@q)) AS tsq) q
                    WHERE n.tsv_meta @@ q.tsq
                    UNION
                    SELECT f.norma_id, ts_rank_cd(f.tsv_es, q.tsq, 32) AS rank
                    FROM norma_fragmento f, (SELECT websearch_to_tsquery('spanish', f_unaccent(@q)) AS tsq) q
                    WHERE f.tsv_es @@ q.tsq
                ),
                """,
            ModoBusqueda.Cualquiera => """
                WITH palabras AS (
                    SELECT string_agg(quote_literal(palabra) || ':*', ' | ') AS consulta
                    FROM unnest(string_to_array(@q, ' ')) AS palabra
                ),
                candidatos AS (
                    SELECT n.id, ts_rank_cd(n.tsv_meta, q.tsq, 32) AS rank
                    FROM norma n, (SELECT to_tsquery('spanish', f_unaccent(consulta)) AS tsq FROM palabras) q
                    WHERE n.tsv_meta @@ q.tsq
                    UNION
                    SELECT f.norma_id, ts_rank_cd(f.tsv_es, q.tsq, 32) AS rank
                    FROM norma_fragmento f, (SELECT to_tsquery('spanish', f_unaccent(consulta)) AS tsq FROM palabras) q
                    WHERE f.tsv_es @@ q.tsq
                ),
                """,
            ModoBusqueda.Frase => """
                WITH candidatos AS (
                    SELECT n.id, ts_rank_cd(n.tsv_meta, q.tsq, 32) AS rank
                    FROM norma n, (SELECT phraseto_tsquery('simple', f_unaccent(@q)) AS tsq) q
                    WHERE n.tsv_meta @@ q.tsq
                    UNION
                    SELECT f.norma_id, ts_rank_cd(f.tsv_lit, q.tsq, 32) AS rank
                    FROM norma_fragmento f, (SELECT phraseto_tsquery('simple', f_unaccent(@q)) AS tsq) q
                    WHERE f.tsv_lit @@ q.tsq
                ),
                """,
            _ => "",
        };
    }

    private static string CteRanking(ModoBusqueda modo)
    {
        return modo switch
        {
            ModoBusqueda.Todas => """
                ranking AS (
                    SELECT id, max(rank) AS rank FROM candidatos GROUP BY id
                )
                """,
            ModoBusqueda.Cualquiera => """
                ranking AS (
                    SELECT id, max(rank) AS rank FROM candidatos GROUP BY id
                )
                """,
            ModoBusqueda.Frase => """
                ranking AS (
                    SELECT id, max(rank) AS rank FROM candidatos GROUP BY id
                )
                """,
            _ => "",
        };
    }

    private (string With, string Where, string RankingJoin, DynamicParameters Parametros) ConstruirNucleo(FiltrosBusqueda filtros)
    {
        var p = new DynamicParameters();
        p.Add("@limit", Math.Clamp(filtros.PageSize, 1, 50));
        p.Add("@offset", Math.Max(0, (filtros.Page - 1) * filtros.PageSize));

        var where = """
            n.visibilidad = 1
            AND n.estado_publicacion IN (4, 5)
            """;

        if (filtros.TipoId is not null)
        {
            where += "\n  AND n.tipo_norma_id = @tipoId";
            p.Add("@tipoId", filtros.TipoId);
        }
        if (filtros.OrganoId is not null)
        {
            where += "\n  AND n.organo_emisor_id = @organoId";
            p.Add("@organoId", filtros.OrganoId);
        }
        if (filtros.Numero is not null)
        {
            where += "\n  AND n.numero = @numero";
            p.Add("@numero", filtros.Numero);
        }
        if (filtros.Anio is not null)
        {
            where += "\n  AND n.anio = @anio";
            p.Add("@anio", filtros.Anio);
        }
        if (filtros.Desde is not null)
        {
            where += "\n  AND n.fecha_sancion >= @desde";
            p.Add("@desde", filtros.Desde.Value.ToDateTime(TimeOnly.MinValue));
        }
        if (filtros.Hasta is not null)
        {
            where += "\n  AND n.fecha_sancion <= @hasta";
            p.Add("@hasta", filtros.Hasta.Value.ToDateTime(TimeOnly.MaxValue));
        }
        if (filtros.Vigencia is not null)
        {
            where += "\n  AND n.vigencia = @vigencia";
            p.Add("@vigencia", (int)filtros.Vigencia);
        }

        var with = "";
        var rankingJoin = "";

        if (!string.IsNullOrWhiteSpace(filtros.Q))
        {
            p.Add("@q", filtros.Q.Trim());
            with = CteCandidatos(filtros.Modo) + "\n" + CteRanking(filtros.Modo);
            where += "\n  AND n.id IN (SELECT id FROM candidatos)";
            rankingJoin = "LEFT JOIN ranking ON ranking.id = n.id";
        }

        return (with, where, rankingJoin, p);
    }

    private static string ConstruirOrden(FiltrosBusqueda filtros)
    {
        if (!string.IsNullOrWhiteSpace(filtros.Q))
        {
            return "ranking.rank DESC NULLS LAST, n.fecha_sancion DESC, n.numero DESC";
        }
        return filtros.Orden switch
        {
            "fecha_asc" => "n.fecha_sancion ASC, n.numero ASC",
            "fecha_desc" => "n.fecha_sancion DESC, n.numero DESC",
            _ => "n.fecha_sancion DESC, n.numero DESC",
        };
    }

    private async Task CompletarSnippetsAsync(
        Npgsql.NpgsqlConnection con,
        FiltrosBusqueda filtros,
        List<ItemResultado> items,
        CancellationToken ct)
    {
        var ids = items.Select(i => i.Id).ToList();

        var tsquery = filtros.Modo == ModoBusqueda.Frase
            ? "phraseto_tsquery('simple', f_unaccent(@q))"
            : "websearch_to_tsquery('spanish', f_unaccent(@q))";
        var tsvector = filtros.Modo == ModoBusqueda.Frase ? "tsv_lit" : "tsv_es";

        var sql = $"""
            SELECT DISTINCT ON (f.norma_id)
                   f.norma_id,
                   ts_headline('spanish', f.texto, {tsquery},
                               'StartSel=<mark>, StopSel=</mark>, MaxWords=45, MinWords=15, MaxFragments=1') AS snippet
            FROM norma_fragmento f
            WHERE f.norma_id = ANY(@ids)
              AND f.{tsvector} @@ {tsquery}
            ORDER BY f.norma_id, ts_rank_cd(f.{tsvector}, {tsquery}, 32) DESC
            """;

        var p = new DynamicParameters();
        p.Add("@q", filtros.Q!.Trim());
        p.Add("@ids", ids);

        var snippets = (await con.QueryAsync<(Guid norma_id, string snippet)>(sql, p))
            .ToDictionary(s => s.norma_id, s => s.snippet);

        foreach (var item in items)
        {
            if (snippets.TryGetValue(item.Id, out var snippet))
            {
                item.Snippet = snippet;
            }
        }
    }

    private async Task<Facetas> CalcularFacetasAsync(Npgsql.NpgsqlConnection con, FiltrosBusqueda filtros, CancellationToken ct)
    {
        var (with, where, _, parametros) = ConstruirNucleo(filtros);

        var sql = $"""
            {with}
            SELECT 'tipo' AS faceta, tn.id AS id, tn.nombre AS nombre, count(*) AS cantidad
            FROM norma n JOIN tipo_norma tn ON tn.id = n.tipo_norma_id
            WHERE {where}
            GROUP BY tn.id, tn.nombre
            UNION ALL
            SELECT 'organo', oe.id, oe.nombre, count(*)
            FROM norma n JOIN organo_emisor oe ON oe.id = n.organo_emisor_id
            WHERE {where}
            GROUP BY oe.id, oe.nombre
            UNION ALL
            SELECT 'anio', n.anio, n.anio::text, count(*)
            FROM norma n
            WHERE {where}
            GROUP BY n.anio
            UNION ALL
            SELECT 'vigencia', n.vigencia, n.vigencia::text, count(*)
            FROM norma n
            WHERE {where}
            GROUP BY n.vigencia
            """;

        var filas = (await con.QueryAsync(sql, parametros)).ToList();

        var facetas = new Facetas([], [], [], []);
        foreach (var fila in filas)
        {
            var conteo = new FacetaConteo((int)fila.id, (string)fila.nombre, (int)fila.cantidad);
            switch ((string)fila.faceta)
            {
                case "tipo": facetas.Tipos.Add(conteo); break;
                case "organo": facetas.Organos.Add(conteo); break;
                case "anio": facetas.Anios.Add(conteo); break;
                case "vigencia": facetas.Vigencias.Add(conteo); break;
            }
        }
        return facetas;
    }
}
