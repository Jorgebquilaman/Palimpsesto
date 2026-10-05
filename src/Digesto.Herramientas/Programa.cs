using System.Diagnostics;
using Dapper;
using Npgsql;
using NpgsqlTypes;

namespace Digesto.Herramientas;

public static class Programa
{
    public static async Task<int> Main(string[] args)
    {
        if (args.Length == 0)
        {
            ImprimirAyuda();
            return 1;
        }

        var cadena = args.Length >= 3
            ? args[2]
            : Environment.GetEnvironmentVariable("ConnectionStrings__Digesto")
            ?? "Host=localhost;Port=5433;Database=digesto;Username=digesto;Password=digesto_dev";

        var fuente = NpgsqlDataSource.Create(cadena);

        switch (args[0])
        {
            case "generar" when args.Length >= 2 && int.TryParse(args[1], out var cantidad):
                await GenerarAsync(fuente, cantidad);
                return 0;
            case "benchmark" when args.Length >= 2 && int.TryParse(args[1], out var consultas):
                return await MedirAsync(fuente, consultas);
            case "benchmark":
                return await MedirAsync(fuente, 200);
            default:
                ImprimirAyuda();
                return 1;
        }
    }

    private static void ImprimirAyuda()
    {
        Console.WriteLine("""
            Uso:
              dotnet run --project src/Digesto.Herramientas -- generar <cantidadNormas> [cadenaConexion]
              dotnet run --project src/Digesto.Herramientas -- benchmark [cadenaConexion]
            """);
    }

    private static async Task GenerarAsync(NpgsqlDataSource fuente, int cantidad)
    {
        await using var con = await fuente.OpenConnectionAsync();
        await using var tx = await con.BeginTransactionAsync();

        var tipoId = await con.ExecuteScalarAsync<int>(
            "INSERT INTO tipo_norma (codigo, nombre, alcance, activo) VALUES ('SYN', 'Norma sintética (benchmark)', 'general', true) " +
            "ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id", transaction: tx);
        var organoId = await con.ExecuteScalarAsync<int>(
            "INSERT INTO organo_emisor (codigo, nombre, activo) VALUES ('SYN', 'Órgano Sintético', true) " +
            "ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id", transaction: tx);

        Console.WriteLine($"Generando {cantidad:n0} normas con 5 fragmentos cada una…");

        var ids = new List<(Guid id, int numero, short anio)>(cantidad);

        await using (var normaWriter = await con.BeginBinaryImportAsync(
            "COPY norma (id, tipo_norma_id, organo_emisor_id, numero, anio, codigo_normalizado, titulo, fecha_sancion, visibilidad, estado_publicacion, texto_origen, creado_en, creado_por, vigencia, palabras_clave) FROM STDIN (FORMAT BINARY)"))
        {
            for (var i = 0; i < cantidad; i++)
            {
                var numero = (i % 9999) + 1;
                var anio = (short)(2000 + (i % 26));
                var id = Guid.NewGuid();
                ids.Add((id, numero, anio));

                var fecha = new DateTime(anio, (i % 12) + 1, (i % 28) + 1, 0, 0, 0, DateTimeKind.Utc);

                await normaWriter.StartRowAsync();
                await normaWriter.WriteAsync(id);
                await normaWriter.WriteAsync(tipoId);
                await normaWriter.WriteAsync(organoId);
                await normaWriter.WriteAsync(numero);
                await normaWriter.WriteAsync(anio);
                await normaWriter.WriteAsync($"SYN-CS-{anio}-{numero:D4}-{i}");
                await normaWriter.WriteAsync($"SYN norm {i} {TextoAleatorio(8, 15)}");
                await normaWriter.WriteAsync(DateOnly.FromDateTime(fecha));
                await normaWriter.WriteAsync(1);
                await normaWriter.WriteAsync(4);
                await normaWriter.WriteAsync(1);
                await normaWriter.WriteAsync(DateTime.UtcNow);
                await normaWriter.WriteAsync("benchmark");
                await normaWriter.WriteAsync(1);
                await normaWriter.WriteAsync(Array.Empty<string>());
            }
            await normaWriter.CompleteAsync();
        }

        await using (var fragmentWriter = await con.BeginBinaryImportAsync(
            "COPY norma_fragmento (norma_id, orden, tipo, etiqueta, texto, html) FROM STDIN (FORMAT BINARY)"))
        {
            foreach (var (id, _, _) in ids)
            {
                for (var f = 1; f <= 5; f++)
                {
                    await fragmentWriter.StartRowAsync();
                    await fragmentWriter.WriteAsync(id);
                    await fragmentWriter.WriteAsync(f);
                    await fragmentWriter.WriteAsync(5);
                    await fragmentWriter.WriteAsync($"Artículo {f}");
                    await fragmentWriter.WriteAsync(TextoAleatorio(60, 140));
                    await fragmentWriter.WriteAsync(DBNull.Value);
                }
            }
            await fragmentWriter.CompleteAsync();
        }

        await tx.CommitAsync();

        Console.WriteLine("ANALYZE…");
        await con.ExecuteAsync("ANALYZE;");
        await con.ExecuteAsync("SELECT pg_prewarm('norma_fragmento');");
        await con.ExecuteAsync("SELECT pg_prewarm('norma');");
        await con.ExecuteAsync("SELECT pg_prewarm('ix_fragmento_tsv_es');");
        await con.ExecuteAsync("SELECT pg_prewarm('ix_norma_tsv_meta');");
        Console.WriteLine($"Listo: {ids.Count:n0} normas / {ids.Count * 5:n0} fragmentos.");
    }

    private static async Task<int> MedirAsync(NpgsqlDataSource fuente, int consultas)
    {
        await using var con = await fuente.OpenConnectionAsync();

        var tieneDatos = await con.ExecuteScalarAsync<long>(
            "SELECT count(*) FROM norma WHERE tipo_norma_id = (SELECT id FROM tipo_norma WHERE codigo = 'SYN')");
        if (tieneDatos == 0)
        {
            Console.WriteLine("No hay datos sintéticos: correr primero `generar`.");
            return 1;
        }

        Console.WriteLine($"Ejecutando {consultas} consultas…");

        await con.ExecuteAsync("SET enable_bitmapscan = on;");
        await con.ExecuteAsync("SET max_parallel_workers_per_gather = 2;");

        var tiempos = new List<long>(consultas * 3);
        var terminos = new[] { "becas", "extensión", "resolución", "concursos", "estudiantes",
            "investigación", "reglamento", "inscripción", "presupuesto", "docentes" };

        for (var i = 0; i < consultas; i++)
        {
            var termino = terminos[i % terminos.Length];

            var sql = $"""
                WITH candidatos AS (
                    SELECT n.id, ts_rank_cd(n.tsv_meta, q.tsq, 32) AS rank
                    FROM norma n, (SELECT websearch_to_tsquery('spanish', f_unaccent(@q)) AS tsq) q
                    WHERE n.tsv_meta @@ q.tsq
                    UNION
                    SELECT f.norma_id, ts_rank_cd(f.tsv_es, q.tsq, 32) AS rank
                    FROM norma_fragmento f, (SELECT websearch_to_tsquery('spanish', f_unaccent(@q)) AS tsq) q
                    WHERE f.tsv_es @@ q.tsq
                ), ranking AS (
                    SELECT id, max(rank) AS rank
                    FROM candidatos
                    GROUP BY id
                    ORDER BY 2 DESC
                    LIMIT 800
                )
                SELECT count(*) OVER () AS total,
                       n.id, n.codigo_normalizado, n.titulo, n.numero, n.anio,
                       n.fecha_sancion, n.fecha_publicacion, n.vigencia, n.texto_origen,
                       ranking.rank, tn.codigo AS tipo_codigo, tn.nombre AS tipo_nombre, oe.nombre AS organo_nombre
                FROM norma n
                JOIN tipo_norma tn ON tn.id = n.tipo_norma_id
                JOIN organo_emisor oe ON oe.id = n.organo_emisor_id
                LEFT JOIN ranking ON ranking.id = n.id
                WHERE n.visibilidad = 1 AND n.estado_publicacion IN (4, 5)
                  AND n.id IN (SELECT id FROM candidatos)
                ORDER BY ranking.rank DESC NULLS LAST, n.fecha_sancion DESC, n.numero DESC
                LIMIT 20
                """;

            var cronometro = Stopwatch.StartNew();
            await con.QueryAsync(sql, new { q = termino });
            cronometro.Stop();
            tiempos.Add(cronometro.ElapsedMilliseconds);
        }

        var ordenados = tiempos.OrderBy(t => t).ToList();
        double Percentil(double p)
        {
            var n = ordenados.Count;
            var k = (n - 1) * p;
            var f = Math.Floor(k);
            var c = Math.Ceiling(k);
            if (f == c) return ordenados[(int)k];
            return ordenados[(int)f] + (k - f) * (ordenados[(int)c] - ordenados[(int)f]);
        }

        Console.WriteLine($"Consultas:    {ordenados.Count}");
        Console.WriteLine($"p50/p95/p99:  {Percentil(0.50):F0} ms / {Percentil(0.95):F0} ms / {Percentil(0.99):F0} ms");
        Console.WriteLine($"máxima:       {ordenados.Last()} ms");
        return 0;
    }

    private static async Task WriteAsync(NpgsqlBinaryImporter writer, object valor, NpgsqlDbType tipo) =>
        await writer.WriteAsync(valor, tipo);

    // Vocabulario realista: la mayoría son palabras de fondo, pocas distintivas.
    // Un término distintivo aparece solo en ~8% de los fragmentos, como "becas" en un digesto real.
    private static readonly string[] TerminosDistintivos =
    [
        "becas", "extensión", "concursos", "cátedras", "inscripción", "artes", "escenario",
        "morbilidad", "panorámica", "tramontana", "laboratorio", "mostrador", "vitalicia",
        "sintaxis", "psicología", "hohorario", "ramatuelle", "arcilla", "quebrada", "anacleto",
    ];

    private static readonly string[] BancoDePalabras =
        Enumerable.Range(0, 220)
            .Select(i => $"vocal{i}casa{i * 7}mundo{i * 3}")
            .Concat([
                "universidad", "norma", "académica", "secretaría", "instituto",
                "patagónico", "comunidad", "plan", "evaluación",
            ])
            .ToArray();

    public static string TextoAleatorio(int minPalabras, int maxPalabras)
    {
        var r = Random.Shared;
        var cantidad = r.Next(minPalabras, maxPalabras + 1);
        var partes = new List<string>(cantidad + 3);
        for (var i = 0; i < cantidad; i++)
        {
            partes.Add(BancoDePalabras[r.Next(BancoDePalabras.Length)]);
        }
        if (r.NextDouble() < 0.08)
        {
            partes.Add(TerminosDistintivos[r.Next(TerminosDistintivos.Length)]);
        }
        if (r.NextDouble() < 0.08)
        {
            partes.Add(TerminosDistintivos[r.Next(TerminosDistintivos.Length)]);
        }
        return string.Join(' ', partes);
    }
}
