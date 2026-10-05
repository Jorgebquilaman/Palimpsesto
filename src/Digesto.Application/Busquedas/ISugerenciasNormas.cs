namespace Digesto.Application.Busquedas;

public record Sugerencia(string Codigo, string Titulo);

public interface ISugerenciasNormas
{
    Task<List<Sugerencia>> SugerirAsync(string q, int limite = 8, CancellationToken ct = default);
}
