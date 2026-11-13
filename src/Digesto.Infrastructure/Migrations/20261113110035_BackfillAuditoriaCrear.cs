using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Digesto.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class BackfillAuditoriaCrear : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                INSERT INTO auditoria (usuario, entidad, entidad_id, accion, antes, despues, norma_codigo, norma_titulo, texto, fecha)
                SELECT n.creado_por,
                       'norma',
                       n.id::text,
                       'crear',
                       NULL,
                       n.codigo_normalizado,
                       n.codigo_normalizado,
                       n.titulo,
                       NULL,
                       n.creado_en
                FROM norma n
                WHERE NOT EXISTS (
                    SELECT 1 FROM auditoria a
                    WHERE a.entidad = 'norma' AND a.entidad_id = n.id::text
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
