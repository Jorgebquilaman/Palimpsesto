using System.Linq.Expressions;
using Digesto.Domain.Entidades;
using Digesto.Domain.Enums;

namespace Digesto.Application.Normas;

/// <summary>Reglas de visibilidad pública compartidas por todos los endpoints públicos.</summary>
public static class NormaFilters
{
    /// <summary>Una norma es visible al público si es pública y está publicada o archivada.</summary>
    public static readonly Expression<Func<Norma, bool>> Published = n =>
        n.Visibilidad == Visibilidad.Publica
        && (n.EstadoPublicacion == EstadoPublicacion.Publicada
            || n.EstadoPublicacion == EstadoPublicacion.Archivada);

    public static IQueryable<Norma> PublishedOnly(this IQueryable<Norma> normas) => normas.Where(Published);
}
