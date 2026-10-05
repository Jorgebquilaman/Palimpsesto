using Dapper;
using Digesto.Application.Busquedas;
using Microsoft.EntityFrameworkCore;

namespace Digesto.Infrastructure.Busquedas;

public class SugerenciasNormas : ISugerenciasNormas
{
    private readonly DbContextOptions<Persistencia.DigestoDbContext> _opciones;

    public SugerenciasNormas(DbContextOptions<Persistencia.DigestoDbContext> opciones)
    {
        _opciones = opciones;
    }

    public async Task<List<Sugerencia>> SugerirAsync(string q, int limite = 8, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
        {
            return [];
        }

        await using var db = new Persistencia.DigestoDbContext(_opciones);
        var con = (Npgsql.NpgsqlConnection)db.Database.GetDbConnection();
        await con.OpenAsync(ct);

        var termino = q.Trim();
        var patron = $"%{termino}%";

        await using var transaccion = await con.BeginTransactionAsync(ct);

        await con.ExecuteAsync("SET LOCAL pg_trgm.similarity_threshold = 0.25;", transaction: transaccion);

        var sql = """
            SELECT n.codigo_normalizado, n.titulo,
                   GREATEST(similarity(n.titulo, @q), similarity(n.codigo_normalizado, @q)) AS sim
            FROM norma n
            WHERE n.visibilidad = 1
              AND n.estado_publicacion IN (4, 5)
              AND (
                    n.titulo % @q
                 OR n.codigo_normalizado % @q
                 OR n.codigo_normalizado ILIKE @prefijo
                 OR n.titulo ILIKE @patron
              )
            ORDER BY sim DESC, n.fecha_sancion DESC
            LIMIT @limite
            """;

        var filas = await con.QueryAsync<(string codigo, string titulo, double sim)>(
            sql,
            new { q = termino, prefijo = termino.ToUpperInvariant() + "%", patron, limite },
            transaction: transaccion);

        await transaccion.CommitAsync(ct);

        return filas
            .OrderByDescending(f => f.sim)
            .Select(f => new Sugerencia(f.codigo, f.titulo))
            .ToList();
    }
}
