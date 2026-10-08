namespace Digesto.Application.Busquedas;

public record PalabraClaveConteo(string Palabra, int Cantidad);

public record ResultadoPalabrasClave(List<PalabraClaveConteo> Palabras, bool HayMas);

public interface IPalabrasClaveNormas
{
    Task<ResultadoPalabrasClave> AgregarAsync(
        int? tipoId,
        int? organoId,
        DateOnly? desde,
        DateOnly? hasta,
        short? anio,
        Domain.Enums.Vigencia? vigencia,
        string? q,
        int limite = 60,
        int offset = 0,
        CancellationToken ct = default);
}
