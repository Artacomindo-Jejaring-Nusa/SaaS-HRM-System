import 'package:flutter/material.dart';
import 'dart:math' as math;

// ══════════════════════════════════════════════════════
// ANIMATION HELPERS — Reusable widgets for smooth UI
// ══════════════════════════════════════════════════════

// ──────────────────────────────────────────────
// 1. Staggered Fade-Slide Animation Wrapper
//    Wraps any child with a fade + vertical slide
// ──────────────────────────────────────────────
class FadeSlideIn extends StatefulWidget {
  final Widget child;
  final Duration delay;
  final Duration duration;
  final double offsetY;
  final Curve curve;

  const FadeSlideIn({
    Key? key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = const Duration(milliseconds: 500),
    this.offsetY = 30.0,
    this.curve = Curves.easeOutCubic,
  }) : super(key: key);

  @override
  State<FadeSlideIn> createState() => _FadeSlideInState();
}

class _FadeSlideInState extends State<FadeSlideIn>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: widget.duration);
    _fadeAnim = CurvedAnimation(parent: _ctrl, curve: widget.curve);
    _slideAnim = Tween<Offset>(
      begin: Offset(0, widget.offsetY / 100),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _ctrl, curve: widget.curve));

    Future.delayed(widget.delay, () {
      if (mounted) _ctrl.forward();
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnim,
      child: SlideTransition(
        position: _slideAnim,
        child: widget.child,
      ),
    );
  }
}

// ──────────────────────────────────────────────
// 2. Scale-on-Tap (Press-down micro-interaction)
// ──────────────────────────────────────────────
class ScaleOnTap extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final double scaleDown;

  const ScaleOnTap({
    Key? key,
    required this.child,
    this.onTap,
    this.scaleDown = 0.96,
  }) : super(key: key);

  @override
  State<ScaleOnTap> createState() => _ScaleOnTapState();
}

class _ScaleOnTapState extends State<ScaleOnTap>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 120),
      lowerBound: 0.0,
      upperBound: 1.0,
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  double get _scale =>
      1.0 - (_ctrl.value * (1.0 - widget.scaleDown));

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _ctrl.forward(),
      onTapUp: (_) {
        _ctrl.reverse();
        widget.onTap?.call();
      },
      onTapCancel: () => _ctrl.reverse(),
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (ctx, child) => Transform.scale(
          scale: _scale,
          child: child,
        ),
        child: widget.child,
      ),
    );
  }
}

// ──────────────────────────────────────────────
// 3. Animated List Item (stagger for list items)
// ──────────────────────────────────────────────
class AnimatedListItem extends StatelessWidget {
  final int index;
  final Widget child;
  final Duration duration;

  const AnimatedListItem({
    Key? key,
    required this.index,
    required this.child,
    this.duration = const Duration(milliseconds: 400),
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return FadeSlideIn(
      delay: Duration(milliseconds: math.min(index * 80, 600)),
      duration: duration,
      offsetY: 20,
      child: child,
    );
  }
}

// ──────────────────────────────────────────────
// 4. Pulse Animation (badges, highlights)
// ──────────────────────────────────────────────
class PulseWidget extends StatefulWidget {
  final Widget child;
  final Duration duration;
  final double minScale;
  final double maxScale;

  const PulseWidget({
    Key? key,
    required this.child,
    this.duration = const Duration(milliseconds: 1500),
    this.minScale = 0.97,
    this.maxScale = 1.03,
  }) : super(key: key);

  @override
  State<PulseWidget> createState() => _PulseWidgetState();
}

class _PulseWidgetState extends State<PulseWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: widget.duration)
      ..repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (ctx, child) {
        final scale = widget.minScale +
            (_ctrl.value * (widget.maxScale - widget.minScale));
        return Transform.scale(scale: scale, child: child);
      },
      child: widget.child,
    );
  }
}

// ──────────────────────────────────────────────
// 5. Smooth Section Reveal (expand/collapse)
// ──────────────────────────────────────────────
class SmoothReveal extends StatefulWidget {
  final Widget child;
  final bool isVisible;
  final Duration duration;
  final Curve curve;

  const SmoothReveal({
    Key? key,
    required this.child,
    this.isVisible = true,
    this.duration = const Duration(milliseconds: 350),
    this.curve = Curves.easeOutCubic,
  }) : super(key: key);

  @override
  State<SmoothReveal> createState() => _SmoothRevealState();
}

class _SmoothRevealState extends State<SmoothReveal>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _sizeAnim;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: widget.duration);
    _sizeAnim = CurvedAnimation(parent: _ctrl, curve: widget.curve);
    _fadeAnim = CurvedAnimation(parent: _ctrl, curve: widget.curve);

    if (widget.isVisible) _ctrl.value = 1.0;
  }

  @override
  void didUpdateWidget(covariant SmoothReveal oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isVisible != oldWidget.isVisible) {
      widget.isVisible ? _ctrl.forward() : _ctrl.reverse();
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizeTransition(
      sizeFactor: _sizeAnim,
      axisAlignment: -1.0,
      child: FadeTransition(
        opacity: _fadeAnim,
        child: widget.child,
      ),
    );
  }
}

// ──────────────────────────────────────────────
// 6. Responsive Helpers
// ──────────────────────────────────────────────
class ResponsiveHelper {
  static double screenWidth(BuildContext context) =>
      MediaQuery.of(context).size.width;

  static double screenHeight(BuildContext context) =>
      MediaQuery.of(context).size.height;

  /// Small phone: < 360, Normal: 360-410, Large: > 410
  static bool isSmallPhone(BuildContext context) => screenWidth(context) < 360;
  static bool isLargePhone(BuildContext context) => screenWidth(context) > 410;

  /// Adaptive font size
  static double fontSize(BuildContext context, double baseFontSize) {
    final width = screenWidth(context);
    if (width < 340) return baseFontSize * 0.85;
    if (width < 375) return baseFontSize * 0.92;
    if (width > 420) return baseFontSize * 1.05;
    return baseFontSize;
  }

  /// Adaptive padding
  static double padding(BuildContext context, double basePadding) {
    final width = screenWidth(context);
    if (width < 340) return basePadding * 0.7;
    if (width < 375) return basePadding * 0.85;
    if (width > 420) return basePadding * 1.1;
    return basePadding;
  }

  /// Adaptive icon size
  static double iconSize(BuildContext context, double baseSize) {
    return fontSize(context, baseSize);
  }

  /// Safe bottom padding (for bottomsheet actions)
  static double safeBottomPadding(BuildContext context) {
    final mPadding = MediaQuery.of(context).viewPadding.bottom;
    return mPadding > 0 ? mPadding : 16;
  }
}

// ──────────────────────────────────────────────
// 7. Animated Counter Text
// ──────────────────────────────────────────────
class AnimatedCounterText extends StatelessWidget {
  final double value;
  final TextStyle style;
  final String Function(double) formatter;
  final Duration duration;

  const AnimatedCounterText({
    Key? key,
    required this.value,
    required this.style,
    required this.formatter,
    this.duration = const Duration(milliseconds: 600),
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: value),
      duration: duration,
      curve: Curves.easeOutCubic,
      builder: (context, animValue, child) {
        return Text(
          formatter(animValue),
          style: style,
        );
      },
    );
  }
}

// ──────────────────────────────────────────────
// 8. Smooth Page Route Transition
// ──────────────────────────────────────────────
class SmoothPageRoute<T> extends PageRouteBuilder<T> {
  final Widget page;

  SmoothPageRoute({required this.page})
      : super(
          transitionDuration: const Duration(milliseconds: 350),
          reverseTransitionDuration: const Duration(milliseconds: 250),
          pageBuilder: (context, animation, secondaryAnimation) => page,
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            final fadeAnim =
                CurvedAnimation(parent: animation, curve: Curves.easeOut);
            final slideAnim = Tween<Offset>(
              begin: const Offset(0, 0.08),
              end: Offset.zero,
            ).animate(
                CurvedAnimation(parent: animation, curve: Curves.easeOutCubic));

            return FadeTransition(
              opacity: fadeAnim,
              child: SlideTransition(
                position: slideAnim,
                child: child,
              ),
            );
          },
        );
}

// ──────────────────────────────────────────────
// 9. Smooth Bottom Sheet Helper
// ──────────────────────────────────────────────
Future<T?> showSmoothBottomSheet<T>({
  required BuildContext context,
  required Widget Function(BuildContext) builder,
  double heightFactor = 0.90,
  Color backgroundColor = Colors.white,
  bool isDismissible = true,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    isDismissible: isDismissible,
    backgroundColor: Colors.transparent,
    builder: (ctx) => Container(
      height: MediaQuery.of(context).size.height * heightFactor,
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: builder(ctx),
    ),
  );
}

// ──────────────────────────────────────────────
// 10. Animated Snackbar
// ──────────────────────────────────────────────
void showAnimatedSnack(BuildContext context, String message, Color color,
    {IconData? icon}) {
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Row(
        children: [
          if (icon != null) ...[
            Icon(icon, color: Colors.white, size: 18),
            const SizedBox(width: 8),
          ],
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
      backgroundColor: color,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      duration: const Duration(seconds: 3),
      animation: CurvedAnimation(
        parent: const AlwaysStoppedAnimation(1),
        curve: Curves.easeOutCubic,
      ),
    ),
  );
}
