namespace Cnap.Attendance.Core.Entities;

public class Club
{
    public string Code { get; set; } = string.Empty;
    public string Nom { get; set; } = string.Empty;
    public TypeClub Type { get; set; } = TypeClub.Autre;
    public bool EstActif { get; set; } = true;
}

/// <summary>Valeurs stockées en base (colonne clubs.type) : Rotary, Rotaract, Interact, Autre.</summary>
public enum TypeClub
{
    Rotary,
    Rotaract,
    Interact,
    Autre
}
