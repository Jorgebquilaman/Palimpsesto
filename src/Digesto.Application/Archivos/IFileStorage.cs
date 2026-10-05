namespace Digesto.Application.Archivos;

public record ArchivoGuardado(string StorageKey, long Bytes);

public interface IFileStorage
{
    string Root { get; }

    Task<ArchivoGuardado> GuardarAsync(Stream contenido, string nombreOriginal, CancellationToken ct = default);
    Task<Stream> AbrirAsync(string storageKey, CancellationToken ct = default);
    Task EliminarAsync(string storageKey, CancellationToken ct = default);
}
