using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Digesto.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class BoletinPdf : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "pdf_bytes",
                table: "boletin",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "pdf_nombre",
                table: "boletin",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "pdf_sha256",
                table: "boletin",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "pdf_storage_key",
                table: "boletin",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "pdf_bytes",
                table: "boletin");

            migrationBuilder.DropColumn(
                name: "pdf_nombre",
                table: "boletin");

            migrationBuilder.DropColumn(
                name: "pdf_sha256",
                table: "boletin");

            migrationBuilder.DropColumn(
                name: "pdf_storage_key",
                table: "boletin");
        }
    }
}
