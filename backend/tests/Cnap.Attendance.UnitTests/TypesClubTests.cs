using Cnap.Attendance.Core.Common;
using Cnap.Attendance.Core.Entities;

namespace Cnap.Attendance.UnitTests;

public class TypesClubTests
{
    [Theory]
    [InlineData("Rotary Club", TypeClub.Rotary)]
    [InlineData("rotary", TypeClub.Rotary)]
    [InlineData("RC", TypeClub.Rotary)]
    [InlineData("Rotaract Club", TypeClub.Rotaract)]
    [InlineData("ROTARACT", TypeClub.Rotaract)]
    [InlineData("Interact Club", TypeClub.Interact)]
    [InlineData("IC", TypeClub.Interact)]
    [InlineData("Autres", TypeClub.Autre)]
    [InlineData("autre", TypeClub.Autre)]
    [InlineData("", TypeClub.Autre)]
    [InlineData(null, TypeClub.Autre)]
    public void Lire_reconnait_les_libelles_courants(string? valeur, TypeClub attendu) =>
        Assert.Equal(attendu, TypesClub.Lire(valeur));

    [Theory]
    [InlineData("Lions Club")]
    [InlineData("Rotary Kiwanis")]
    public void Lire_retourne_null_pour_un_type_inconnu(string valeur) =>
        Assert.Null(TypesClub.Lire(valeur));
}
