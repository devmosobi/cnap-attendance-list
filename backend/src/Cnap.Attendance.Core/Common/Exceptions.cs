namespace Cnap.Attendance.Core.Common;

/// <summary>Erreur métier dont le message est destiné à l'utilisateur final.</summary>
public abstract class MetierException(string message) : Exception(message);

public sealed class IntrouvableException(string message) : MetierException(message);

public sealed class ConflitException(string message) : MetierException(message);

public sealed class RegleMetierException(string message) : MetierException(message);

public sealed class IndisponibleException(string message) : MetierException(message);
