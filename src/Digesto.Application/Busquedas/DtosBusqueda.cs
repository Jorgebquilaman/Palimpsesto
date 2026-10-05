using Digesto.Application.Busquedas;

namespace Digesto.Application.Busquedas;

public record FiltrosBusqueda(
    string? Q,
    ModoBusqueda Modo,
    int? Numero,
    short? Anio,
    int? TipoId,
    int? OrganoId,
    DateOnly? Desde,
    DateOnly? Hasta,
    Domain.Enums.Vigencia? Vigencia,
    string? Orden,
    int Page,
    int PageSize);

public class ItemResultado
{
    public Guid Id { get; init; }
    public string Codigo { get; init; } = null!;
    public string TipoCodigo { get; init; } = null!;
    public string TipoNombre { get; init; } = null!;
    public string OrganoNombre { get; init; } = null!;
    public int Numero { get; init; }
    public short Anio { get; init; }
    public string Titulo { get; init; } = null!;
    public DateOnly FechaSancion { get; init; }
    public DateOnly? FechaPublicacion { get; init; }
    public string Vigencia { get; init; } = null!;
    public string? Snippet { get; set; }
    public bool TieneOcr { get; init; }
}

public record FacetaConteo(int Id, string Nombre, int Cantidad);

public record Facetas(
    List<FacetaConteo> Tipos,
    List<FacetaConteo> Organos,
    List<FacetaConteo> Anios,
    List<FacetaConteo> Vigencias);

public record ResultadoBusqueda(
    List<ItemResultado> Items,
    Facetas Facetas,
    int Total,
    long TookMs,
    string? CodigoCitaDirecta);
