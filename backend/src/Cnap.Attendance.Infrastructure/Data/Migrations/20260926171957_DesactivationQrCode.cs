using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cnap.Attendance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class DesactivationQrCode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_qr_codes_actif_complet",
                table: "qr_codes");

            migrationBuilder.DropCheckConstraint(
                name: "ck_qr_codes_statut",
                table: "qr_codes");

            migrationBuilder.AddCheckConstraint(
                name: "ck_qr_codes_actif_complet",
                table: "qr_codes",
                sql: "statut <> 'Actif' OR (nom_complet IS NOT NULL AND email IS NOT NULL AND club_code IS NOT NULL AND seminaire_id IS NOT NULL AND date_activation IS NOT NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_qr_codes_statut",
                table: "qr_codes",
                sql: "statut IN ('Inactif', 'Actif', 'Desactive')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_qr_codes_actif_complet",
                table: "qr_codes");

            migrationBuilder.DropCheckConstraint(
                name: "ck_qr_codes_statut",
                table: "qr_codes");

            migrationBuilder.AddCheckConstraint(
                name: "ck_qr_codes_actif_complet",
                table: "qr_codes",
                sql: "statut = 'Inactif' OR (nom_complet IS NOT NULL AND email IS NOT NULL AND club_code IS NOT NULL AND seminaire_id IS NOT NULL AND date_activation IS NOT NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_qr_codes_statut",
                table: "qr_codes",
                sql: "statut IN ('Inactif', 'Actif')");
        }
    }
}
