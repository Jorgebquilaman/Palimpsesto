using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Digesto.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Bitacora : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE auditoria ADD COLUMN norma_codigo text;
                ALTER TABLE auditoria ADD COLUMN norma_titulo text;
                ALTER TABLE auditoria ADD COLUMN texto text;

                UPDATE auditoria a
                SET norma_codigo = n.codigo_normalizado,
                    norma_titulo = n.titulo
                FROM norma n
                WHERE a.entidad = 'norma' AND a.entidad_id = n.id::text;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "norma_codigo",
                table: "auditoria");

            migrationBuilder.DropColumn(
                name: "norma_titulo",
                table: "auditoria");

            migrationBuilder.DropColumn(
                name: "texto",
                table: "auditoria");
        }
    }
}
