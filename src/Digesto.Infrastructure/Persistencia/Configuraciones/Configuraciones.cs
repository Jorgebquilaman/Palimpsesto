using Digesto.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Digesto.Infrastructure.Persistencia.Configuraciones;

public class TipoNormaConfig : IEntityTypeConfiguration<TipoNorma>
{
    public void Configure(EntityTypeBuilder<TipoNorma> b)
    {
        b.ToTable("tipo_norma");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
        b.Property(x => x.Codigo).HasColumnName("codigo").HasMaxLength(10).IsRequired();
        b.Property(x => x.Nombre).HasColumnName("nombre").HasMaxLength(100).IsRequired();
        b.Property(x => x.Alcance).HasColumnName("alcance").HasMaxLength(20).IsRequired();
        b.Property(x => x.Activo).HasColumnName("activo");
        b.HasIndex(x => x.Codigo).IsUnique().HasDatabaseName("ix_tipo_norma_codigo");
    }
}

public class OrganoEmisorConfig : IEntityTypeConfiguration<OrganoEmisor>
{
    public void Configure(EntityTypeBuilder<OrganoEmisor> b)
    {
        b.ToTable("organo_emisor");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
        b.Property(x => x.Codigo).HasColumnName("codigo").HasMaxLength(10).IsRequired();
        b.Property(x => x.Nombre).HasColumnName("nombre").HasMaxLength(150).IsRequired();
        b.Property(x => x.PadreId).HasColumnName("padre_id");
        b.Property(x => x.Activo).HasColumnName("activo");
        b.HasIndex(x => x.Codigo).IsUnique().HasDatabaseName("ix_organo_emisor_codigo");
        b.HasOne(x => x.Padre).WithMany(x => x.Hijos).HasForeignKey(x => x.PadreId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class MateriaConfig : IEntityTypeConfiguration<Materia>
{
    public void Configure(EntityTypeBuilder<Materia> b)
    {
        b.ToTable("materia");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
        b.Property(x => x.PadreId).HasColumnName("padre_id");
        b.Property(x => x.Nombre).HasColumnName("nombre").HasMaxLength(150).IsRequired();
        b.Property(x => x.Slug).HasColumnName("slug").HasMaxLength(150).IsRequired();
        b.HasIndex(x => x.Slug).IsUnique().HasDatabaseName("ix_materia_slug");
        b.HasOne(x => x.Padre).WithMany(x => x.Hijas).HasForeignKey(x => x.PadreId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class NormaMateriaConfig : IEntityTypeConfiguration<NormaMateria>
{
    public void Configure(EntityTypeBuilder<NormaMateria> b)
    {
        b.ToTable("norma_materia");
        b.HasKey(x => new { x.NormaId, x.MateriaId });
        b.Property(x => x.NormaId).HasColumnName("norma_id");
        b.Property(x => x.MateriaId).HasColumnName("materia_id");
        b.HasOne(x => x.Norma).WithMany(x => x.Materias).HasForeignKey(x => x.NormaId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Materia).WithMany(x => x.Normas).HasForeignKey(x => x.MateriaId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class BoletinConfig : IEntityTypeConfiguration<Boletin>
{
    public void Configure(EntityTypeBuilder<Boletin> b)
    {
        b.ToTable("boletin");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
        b.Property(x => x.Numero).HasColumnName("numero").HasMaxLength(50).IsRequired();
        b.Property(x => x.FechaPublicacion).HasColumnName("fecha_publicacion");
        b.Property(x => x.ArchivoId).HasColumnName("archivo_id");
        b.Property(x => x.Observaciones).HasColumnName("observaciones");
        b.HasIndex(x => x.Numero).IsUnique().HasDatabaseName("ix_boletin_numero");
    }
}

public class NormaConfig : IEntityTypeConfiguration<Norma>
{
    public void Configure(EntityTypeBuilder<Norma> b)
    {
        b.ToTable("norma");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        b.Property(x => x.TipoNormaId).HasColumnName("tipo_norma_id");
        b.Property(x => x.OrganoEmisorId).HasColumnName("organo_emisor_id");
        b.Property(x => x.Numero).HasColumnName("numero");
        b.Property(x => x.Anio).HasColumnName("anio");
        b.Property(x => x.Sufijo).HasColumnName("sufijo").HasMaxLength(10);
        b.Property(x => x.CodigoNormalizado).HasColumnName("codigo_normalizado").HasMaxLength(60).IsRequired();
        b.Property(x => x.Titulo).HasColumnName("titulo").HasMaxLength(500).IsRequired();
        b.Property(x => x.Resumen).HasColumnName("resumen");
        b.Property(x => x.PalabrasClave).HasColumnName("palabras_clave");
        b.Property(x => x.Expediente).HasColumnName("expediente").HasMaxLength(50);
        b.Property(x => x.FechaSancion).HasColumnName("fecha_sancion");
        b.Property(x => x.FechaPublicacion).HasColumnName("fecha_publicacion");
        b.Property(x => x.BoletinId).HasColumnName("boletin_id");
        b.Property(x => x.Vigencia).HasColumnName("vigencia");
        b.Property(x => x.Visibilidad).HasColumnName("visibilidad");
        b.Property(x => x.EstadoPublicacion).HasColumnName("estado_publicacion");
        b.Property(x => x.TextoOrigen).HasColumnName("texto_origen");
        b.Property(x => x.CalidadOcr).HasColumnName("calidad_ocr");
        b.Property(x => x.CreadoEn).HasColumnName("creado_en");
        b.Property(x => x.ActualizadoEn).HasColumnName("actualizado_en");
        b.Property(x => x.CreadoPor).HasColumnName("creado_por").HasMaxLength(200).IsRequired();
        b.Property(x => x.ActualizadoPor).HasColumnName("actualizado_por").HasMaxLength(200);

        b.HasIndex(x => x.CodigoNormalizado).IsUnique().HasDatabaseName("ix_norma_codigo_normalizado");
        b.HasIndex(x => new { x.Anio, x.Numero }).HasDatabaseName("ix_norma_anio_numero");
        b.HasIndex(x => x.TipoNormaId).HasDatabaseName("ix_norma_tipo_norma_id");
        b.HasIndex(x => x.OrganoEmisorId).HasDatabaseName("ix_norma_organo_emisor_id");
        b.HasIndex(x => x.FechaSancion).HasDatabaseName("ix_norma_fecha_sancion");
        b.HasIndex(x => x.Visibilidad).HasDatabaseName("ix_norma_visibilidad");
        b.HasIndex(x => x.EstadoPublicacion).HasDatabaseName("ix_norma_estado_publicacion");

        b.HasOne(x => x.TipoNorma).WithMany(x => x.Normas).HasForeignKey(x => x.TipoNormaId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.OrganoEmisor).WithMany(x => x.Normas).HasForeignKey(x => x.OrganoEmisorId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Boletin).WithMany(x => x.Normas).HasForeignKey(x => x.BoletinId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class NormaArchivoConfig : IEntityTypeConfiguration<NormaArchivo>
{
    public void Configure(EntityTypeBuilder<NormaArchivo> b)
    {
        b.ToTable("norma_archivo");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        b.Property(x => x.NormaId).HasColumnName("norma_id");
        b.Property(x => x.Rol).HasColumnName("rol");
        b.Property(x => x.NombreOriginal).HasColumnName("nombre_original").HasMaxLength(300).IsRequired();
        b.Property(x => x.StorageKey).HasColumnName("storage_key").HasMaxLength(300).IsRequired();
        b.Property(x => x.Sha256).HasColumnName("sha256").HasMaxLength(64).IsRequired();
        b.Property(x => x.Mime).HasColumnName("mime").HasMaxLength(100).IsRequired();
        b.Property(x => x.Bytes).HasColumnName("bytes");
        b.Property(x => x.Paginas).HasColumnName("paginas");
        b.Property(x => x.FirmaDigital).HasColumnName("firma_digital");

        b.HasIndex(x => x.Sha256).HasDatabaseName("ix_norma_archivo_sha256");
        b.HasIndex(x => x.NormaId).HasDatabaseName("ix_norma_archivo_norma_id");

        b.HasOne(x => x.Norma).WithMany(x => x.Archivos).HasForeignKey(x => x.NormaId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class NormaFragmentoConfig : IEntityTypeConfiguration<NormaFragmento>
{
    public void Configure(EntityTypeBuilder<NormaFragmento> b)
    {
        b.ToTable("norma_fragmento");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
        b.Property(x => x.NormaId).HasColumnName("norma_id");
        b.Property(x => x.Orden).HasColumnName("orden");
        b.Property(x => x.Tipo).HasColumnName("tipo");
        b.Property(x => x.Etiqueta).HasColumnName("etiqueta").HasMaxLength(100);
        b.Property(x => x.Texto).HasColumnName("texto").IsRequired();
        b.Property(x => x.Html).HasColumnName("html");
        b.Property(x => x.PaginaDesde).HasColumnName("pagina_desde");
        b.Property(x => x.PaginaHasta).HasColumnName("pagina_hasta");

        b.HasIndex(x => new { x.NormaId, x.Orden }).HasDatabaseName("ix_fragmento_norma");

        b.HasOne(x => x.Norma).WithMany(x => x.Fragmentos).HasForeignKey(x => x.NormaId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class NormaRelacionConfig : IEntityTypeConfiguration<NormaRelacion>
{
    public void Configure(EntityTypeBuilder<NormaRelacion> b)
    {
        b.ToTable("norma_relacion");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
        b.Property(x => x.NormaOrigenId).HasColumnName("norma_origen_id");
        b.Property(x => x.NormaDestinoId).HasColumnName("norma_destino_id");
        b.Property(x => x.Tipo).HasColumnName("tipo");
        b.Property(x => x.Detalle).HasColumnName("detalle").HasMaxLength(500);

        b.HasIndex(x => new { x.NormaOrigenId, x.NormaDestinoId, x.Tipo })
            .IsUnique().HasDatabaseName("ix_norma_relacion_unica");

        b.HasOne(x => x.NormaOrigen).WithMany().HasForeignKey(x => x.NormaOrigenId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.NormaDestino).WithMany().HasForeignKey(x => x.NormaDestinoId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ProcesoIngestaConfig : IEntityTypeConfiguration<ProcesoIngesta>
{
    public void Configure(EntityTypeBuilder<ProcesoIngesta> b)
    {
        b.ToTable("proceso_ingesta");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
        b.Property(x => x.NormaId).HasColumnName("norma_id");
        b.Property(x => x.ArchivoId).HasColumnName("archivo_id");
        b.Property(x => x.Estado).HasColumnName("estado");
        b.Property(x => x.Etapa).HasColumnName("etapa").HasMaxLength(100);
        b.Property(x => x.Intentos).HasColumnName("intentos");
        b.Property(x => x.Error).HasColumnName("error");
        b.Property(x => x.LockedAt).HasColumnName("locked_at");

        b.HasIndex(x => new { x.Estado, x.Id }).HasDatabaseName("ix_proceso_ingesta_cola");

        b.HasOne(x => x.Norma).WithMany().HasForeignKey(x => x.NormaId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Archivo).WithMany().HasForeignKey(x => x.ArchivoId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ConsultaBusquedaConfig : IEntityTypeConfiguration<ConsultaBusqueda>
{
    public void Configure(EntityTypeBuilder<ConsultaBusqueda> b)
    {
        b.ToTable("consulta_busqueda");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
        b.Property(x => x.Q).HasColumnName("q").HasMaxLength(500);
        b.Property(x => x.Filtros).HasColumnName("filtros");
        b.Property(x => x.Total).HasColumnName("total");
        b.Property(x => x.Ms).HasColumnName("ms");
        b.Property(x => x.Fecha).HasColumnName("fecha");

        b.HasIndex(x => x.Fecha).HasDatabaseName("ix_consulta_busqueda_fecha");
    }
}

public class AuditoriaConfig : IEntityTypeConfiguration<Auditoria>
{
    public void Configure(EntityTypeBuilder<Auditoria> b)
    {
        b.ToTable("auditoria");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
        b.Property(x => x.Usuario).HasColumnName("usuario").HasMaxLength(200).IsRequired();
        b.Property(x => x.Entidad).HasColumnName("entidad").HasMaxLength(100).IsRequired();
        b.Property(x => x.EntidadId).HasColumnName("entidad_id").HasMaxLength(100).IsRequired();
        b.Property(x => x.Accion).HasColumnName("accion").HasMaxLength(50).IsRequired();
        b.Property(x => x.Antes).HasColumnName("antes");
        b.Property(x => x.Despues).HasColumnName("despues");
        b.Property(x => x.Fecha).HasColumnName("fecha");

        b.HasIndex(x => new { x.Entidad, x.EntidadId }).HasDatabaseName("ix_auditoria_entidad");
        b.HasIndex(x => x.Fecha).HasDatabaseName("ix_auditoria_fecha");
    }
}
