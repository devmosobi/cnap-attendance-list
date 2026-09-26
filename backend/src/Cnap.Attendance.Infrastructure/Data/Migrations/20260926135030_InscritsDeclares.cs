using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cnap.Attendance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class InscritsDeclares : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "inscrits_declares",
                table: "seminaires",
                type: "integer",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_seminaires_inscrits_declares",
                table: "seminaires",
                sql: "inscrits_declares IS NULL OR inscrits_declares >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_seminaires_inscrits_declares",
                table: "seminaires");

            migrationBuilder.DropColumn(
                name: "inscrits_declares",
                table: "seminaires");
        }
    }
}
