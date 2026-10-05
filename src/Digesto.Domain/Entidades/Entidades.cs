namespace Digesto.Domain.Entidades;

public class TipoNorma
{
    public int Id { get; set; }
    public string Codigo { get; set; } = null!;
    public string Nombre { get; set; } = null!;
    public string Alcance { get; set; } = "general";
    public bool Activo { get; set; } = true;

    public virtual ICollection<Norma> Normas { get; set; } = new List<Norma>();
}

public class OrganoEmisor
{
    public int Id { get; set; }
    public string Codigo { get; set; } = null!;
    public string Nombre { get; set; } = null!;
    public int? PadreId { get; set; }
    public bool Activo { get; set; } = true;

    public virtual OrganoEmisor? Padre { get; set; }
    public virtual ICollection<OrganoEmisor> Hijos { get; set; } = new List<OrganoEmisor>();
    public virtual ICollection<Norma> Normas { get; set; } = new List<Norma>();
}

public class Materia
{
    public int Id { get; set; }
    public int? PadreId { get; set; }
    public string Nombre { get; set; } = null!;
    public string Slug { get; set; } = null!;

    public virtual Materia? Padre { get; set; }
    public virtual ICollection<Materia> Hijas { get; set; } = new List<Materia>();
    public virtual ICollection<NormaMateria> Normas { get; set; } = new List<NormaMateria>();
}

public class NormaMateria
{
    public Guid NormaId { get; set; }
    public int MateriaId { get; set; }

    public virtual Norma Norma { get; set; } = null!;
    public virtual Materia Materia { get; set; } = null!;
}

public class Boletin
{
    public int Id { get; set; }
    public string Numero { get; set; } = null!;
    public DateOnly FechaPublicacion { get; set; }
    public Guid? ArchivoId { get; set; }
    public string? Observaciones { get; set; }
    public string? PdfNombre { get; set; }
    public string? PdfStorageKey { get; set; }
    public string? PdfSha256 { get; set; }
    public long? PdfBytes { get; set; }

    public virtual ICollection<Norma> Normas { get; set; } = new List<Norma>();
}

public class Norma
{
    public Guid Id { get; set; }
    public int TipoNormaId { get; set; }
    public int OrganoEmisorId { get; set; }
    public int Numero { get; set; }
    public short Anio { get; set; }
    public string? Sufijo { get; set; }
    public string CodigoNormalizado { get; set; } = null!;
    public string Titulo { get; set; } = null!;
    public string? Resumen { get; set; }
    public string[]? PalabrasClave { get; set; }
    public string? Expediente { get; set; }
    public DateOnly FechaSancion { get; set; }
    public DateOnly? FechaPublicacion { get; set; }
    public int? BoletinId { get; set; }
    public Domain.Enums.Vigencia Vigencia { get; set; } = Domain.Enums.Vigencia.Vigente;
    public Domain.Enums.Visibilidad Visibilidad { get; set; } = Domain.Enums.Visibilidad.Publica;
    public Domain.Enums.EstadoPublicacion EstadoPublicacion { get; set; } = Domain.Enums.EstadoPublicacion.Borrador;
    public Domain.Enums.TextoOrigen TextoOrigen { get; set; } = Domain.Enums.TextoOrigen.Nativo;
    public decimal? CalidadOcr { get; set; }
    public DateTime CreadoEn { get; set; }
    public DateTime? ActualizadoEn { get; set; }
    public string CreadoPor { get; set; } = null!;
    public string? ActualizadoPor { get; set; }

    public virtual TipoNorma TipoNorma { get; set; } = null!;
    public virtual OrganoEmisor OrganoEmisor { get; set; } = null!;
    public virtual Boletin? Boletin { get; set; }
    public virtual ICollection<NormaArchivo> Archivos { get; set; } = new List<NormaArchivo>();
    public virtual ICollection<NormaFragmento> Fragmentos { get; set; } = new List<NormaFragmento>();
    public virtual ICollection<NormaMateria> Materias { get; set; } = new List<NormaMateria>();
}

public class NormaArchivo
{
    public Guid Id { get; set; }
    public Guid NormaId { get; set; }
    public Domain.Enums.RolArchivo Rol { get; set; } = Domain.Enums.RolArchivo.Original;
    public string NombreOriginal { get; set; } = null!;
    public string StorageKey { get; set; } = null!;
    public string Sha256 { get; set; } = null!;
    public string Mime { get; set; } = "application/pdf";
    public long Bytes { get; set; }
    public int Paginas { get; set; }
    public string? FirmaDigital { get; set; }

    public virtual Norma Norma { get; set; } = null!;
}

public class NormaFragmento
{
    public long Id { get; set; }
    public Guid NormaId { get; set; }
    public int Orden { get; set; }
    public Domain.Enums.TipoFragmento Tipo { get; set; }
    public string? Etiqueta { get; set; }
    public string Texto { get; set; } = null!;
    public string? Html { get; set; }
    public int? PaginaDesde { get; set; }
    public int? PaginaHasta { get; set; }

    public virtual Norma Norma { get; set; } = null!;
}

public class NormaRelacion
{
    public long Id { get; set; }
    public Guid NormaOrigenId { get; set; }
    public Guid NormaDestinoId { get; set; }
    public Domain.Enums.TipoRelacion Tipo { get; set; }
    public string? Detalle { get; set; }

    public virtual Norma NormaOrigen { get; set; } = null!;
    public virtual Norma NormaDestino { get; set; } = null!;
}

public class ProcesoIngesta
{
    public long Id { get; set; }
    public Guid NormaId { get; set; }
    public Guid ArchivoId { get; set; }
    public Domain.Enums.EstadoProceso Estado { get; set; } = Domain.Enums.EstadoProceso.Pendiente;
    public string? Etapa { get; set; }
    public int Intentos { get; set; }
    public string? Error { get; set; }
    public DateTime? LockedAt { get; set; }

    public virtual Norma Norma { get; set; } = null!;
    public virtual NormaArchivo Archivo { get; set; } = null!;
}

public class ConsultaBusqueda
{
    public long Id { get; set; }
    public string? Q { get; set; }
    public string? Filtros { get; set; }
    public int Total { get; set; }
    public int Ms { get; set; }
    public DateTime Fecha { get; set; } = DateTime.UtcNow;
}

public class Auditoria
{
    public long Id { get; set; }
    public string Usuario { get; set; } = null!;
    public string Entidad { get; set; } = null!;
    public string EntidadId { get; set; } = null!;
    public string Accion { get; set; } = null!;
    public string? Antes { get; set; }
    public string? Despues { get; set; }
    public DateTime Fecha { get; set; } = DateTime.UtcNow;
}
