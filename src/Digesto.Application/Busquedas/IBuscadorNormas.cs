namespace Digesto.Application.Busquedas;

public interface IBuscadorNormas
{
    Task<ResultadoBusqueda> BuscarAsync(FiltrosBusqueda filtros, CancellationToken ct = default);
}
