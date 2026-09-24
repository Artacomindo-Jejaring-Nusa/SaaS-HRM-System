library;

/// BotResponse — Model class for Artacom Bot responses.
///
/// Represents the structured output from the rule engine,
/// containing the bot's mood, message, UI component hint,
/// data payload, action buttons, and optional media.

class BotAction {
  final String label;
  final String actionCode;

  const BotAction({required this.label, required this.actionCode});
}

class BotResponse {
  /// Bot mood determines avatar expression & UI color accent.
  /// Values: happy, neutral, concerned, sleepy, excited, urgent
  final String mood;

  /// Main text message from the bot.
  final String message;

  /// Optional: hint for which rich card widget to render inline.
  /// e.g. 'BotLeaveBalanceCard', 'BotSalaryStatusCard', etc.
  final String? uiComponent;

  /// Optional: structured data for the card widget.
  final Map<String, dynamic>? dataPayload;

  /// Optional: action buttons shown below the message/card.
  final List<BotAction>? actionButtons;

  /// Optional: media asset URL (local or remote).
  final String? mediaUrl;

  /// The resolved intent name for context memory.
  final String? intentName;

  /// Optional: Screen navigation code (e.g. 'NAV_LEAVE', 'NAV_SALARY')
  final String? navigationTarget;

  const BotResponse({
    required this.mood,
    required this.message,
    this.uiComponent,
    this.dataPayload,
    this.actionButtons,
    this.mediaUrl,
    this.intentName,
    this.navigationTarget,
  });
}
