using System.Security.Cryptography;
using Digesto.Application.Archivos;

namespace Digesto.Infrastructure.Archivos;

public class FileStorageLocal : IFileStorage
{
    private readonly string _root;

    public FileStorageLocal(string root)
    {
        _root = root;
        Directory.CreateDirectory(_root);
    }

    public async Task<ArchivoGuardado> GuardarAsync(Stream contenido, string nombreOriginal, CancellationToken ct = default)
    {
        var extension = Path.GetExtension(nombreOriginal);
        var subcarpeta = DateTime.UtcNow.ToString("yyyy/MM");
        var nombreGenerado = $"{Guid.NewGuid()}{extension}";
        var rutaRelativa = Path.Combine(subcarpeta, nombreGenerado);
        var rutaCompleta = RutaAbsoluta(rutaRelativa);

        Directory.CreateDirectory(Path.GetDirectoryName(rutaCompleta)!);

        await using (var destino = File.Create(rutaCompleta))
        {
            await contenido.CopyToAsync(destino, ct);
        }

        return new ArchivoGuardado(rutaRelativa, new FileInfo(rutaCompleta).Length);
    }

    public Task<Stream> AbrirAsync(string storageKey, CancellationToken ct = default)
    {
        var ruta = RutaAbsoluta(storageKey);
        return Task.FromResult<Stream>(File.OpenRead(ruta));
    }

    public Task EliminarAsync(string storageKey, CancellationToken ct = default)
    {
        var ruta = RutaAbsoluta(storageKey);
        if (File.Exists(ruta))
        {
            File.Delete(ruta);
        }
        return Task.CompletedTask;
    }

    private string RutaAbsoluta(string storageKey)
    {
        if (storageKey.Contains("..") || Path.IsPathRooted(storageKey))
        {
            throw new ArgumentException("storage_key inválido");
        }
        return Path.Combine(_root, storageKey);
    }
}
