using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cnap.Attendance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class BilletsReservesSeminaire : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "reserve_au_seminaire",
                table: "qr_codes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddCheckConstraint(
                name: "ck_qr_codes_reserve_seminaire",
                table: "qr_codes",
                sql: "NOT reserve_au_seminaire OR seminaire_id IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_qr_codes_reserve_seminaire",
                table: "qr_codes");

            migrationBuilder.DropColumn(
                name: "reserve_au_seminaire",
                table: "qr_codes");
        }
    }
}
