using System.Text.Json;

namespace Digesto.Infrastructure;

public static class AuditoriaHelper
{
    public static string Serializar(object valor) =>
        JsonSerializer.Serialize(valor, new JsonSerializerOptions
        {
            WriteIndented = false,
        });
}
