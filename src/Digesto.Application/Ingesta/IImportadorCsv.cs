namespace Digesto.Application.Ingesta;

public record FilaImportacion(
    string Archivo,
    string? TipoCodigo,
    int? Numero,
    short? Anio,
    string? Sufijo,
    string? Titulo,
    string? FechaSancion,
    string? FechaPublicacion,
    string? Visibilidad,
    string? Vigencia,
    string? Resumen,
    string? Expediente,
    string[]? PalabrasClave);

public interface IImportadorCsv
{
    List<FilaImportacion> Parsear(string contenidoCsv);
}
