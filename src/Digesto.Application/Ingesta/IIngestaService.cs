namespace Digesto.Application.Ingesta;

public record NormaCreada(Guid NormaId, Guid ArchivoId, string Sha256, bool Duplicado);

public interface IIngestaService
{
    Task<NormaCreada> SubirPdfAsync(Stream contenido, string nombreOriginal, string usuario, CancellationToken ct = default);
}
