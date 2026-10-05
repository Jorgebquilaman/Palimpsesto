using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Digesto.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RecalcularCodigosMetadatos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Recodifica las normas que ya tienen número: el código pasa a ser
            // TIPO-ORGANO-ANIO-NUMERO (los borradores con numero=0 conservan el autonumérico temporal).
            migrationBuilder.Sql("""
                UPDATE norma n
                SET codigo_normalizado = tn.codigo || '-' || oe.codigo || '-' || n.anio || '-' || lpad(n.numero::text, 4, '0')
                FROM tipo_norma tn, organo_emisor oe
                WHERE n.tipo_norma_id = tn.id
                  AND n.organo_emisor_id = oe.id
                  AND n.numero > 0
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
