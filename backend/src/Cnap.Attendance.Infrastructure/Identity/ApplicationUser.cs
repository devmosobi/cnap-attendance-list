using Microsoft.AspNetCore.Identity;

namespace Cnap.Attendance.Infrastructure.Identity;

public class ApplicationUser : IdentityUser<Guid>
{
    public string NomComplet { get; set; } = string.Empty;
    public bool EstActif { get; set; } = true;
    public bool DoitChangerMotDePasse { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
