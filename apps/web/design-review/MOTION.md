# Motion policy: match individual components

Checked against the installed public `@heroui/styles` 3.2.6 sources under
`dist/components/` and licensed reference component CSS. This describes the pinned
version, not every HeroUI release. Absence of an override is observable behavior,
not evidence that its authors deliberately made an accessibility exception.

| Component/effect                                        | Installed behavior with device reduced motion                                                     | Replacement policy                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Stepper completion pop / checkmark drawing              | Disabled explicitly                                                                               | Disable scaling and stroke drawing.                                    |
| Stepper connecting progress line                        | Its 300ms transform transition remains                                                            | Preserve the short progress transition.                                |
| Stepper title/description color                         | Color transitions remain                                                                          | Do not blanket-disable semantic color feedback.                        |
| Sidebar width / offcanvas movement / group-label sizing | Explicitly disabled                                                                               | Disable layout movement and drawer sliding.                            |
| Sidebar indicator rotation                              | A transition is declared, but its reduced-motion rule disables **animation**, not that transition | Record this inconsistency; do not infer a deliberate policy from it.   |
| Pro command opening/closing and dialog-height movement  | Explicitly disabled                                                                               | Disable search opening/closing movement.                               |
| Public Modal opening/closing                            | Explicitly disabled                                                                               | Keep public behavior for modal-based command composition.              |
| Public Drawer backdrop / panel movement                 | Explicitly disabled                                                                               | Skip the custom WAAPI navigation movement as well.                     |
| Public Tooltip entering/exiting                         | Fade, scale and placement translation remain; trigger transitions are disabled                    | Retain the public tooltip implementation.                              |
| Public Select popover entering/exiting                  | Fade, scale and placement translation remain; trigger/value transitions have reduced-motion rules | Retain the public select implementation.                               |
| Public Spinner                                          | Rotation explicitly disabled                                                                      | Keep its public behavior; do not invent an essential-motion exception. |

There is no universal “all fades remain” or “all animations stop” rule in this
version. Some retained effects include scale/translation, not only color/fade.
Preserve the component behavior unless there is a concrete reason to change it;
record intentional deviations rather than silently presenting them as parity.

The comparison's **Reduced motion** option applies component-specific rules, not
`* { animation: none; transition: none }`. **Follow device** uses the device
preference. **Animated** is a visual-review mode, not a proposed application setting.
Public components retain their own device-preference rules in that mode.

This revises revision 6's earlier audit expectation that the stepper connector
should stop. It should keep moving to match the pinned reference. The completion
pop and checkmark drawing still stop. Chart animation stays off in both fixtures,
as in the product's existing charts; this is independent of motion preference.

Before adding a candidate from COMPONENT-ROADMAP.md, inspect its own motion rules,
including pseudo-elements, portals and JavaScript animation paths. Test both the
retained effects and the disabled ones. Never deduce author intent solely from
missing CSS or disable every descendant as a substitute for that review.

## Extended catalog

The 52-entry catalog follows the browser/device preference in both columns; the
original five-component review controls are specific to that original screen.
The extended source inventory is in MOTION-INVENTORY.md. Retained carousel
scrolling, press feedback and count animation are delegated to their open-source
engines rather than disabled with a descendant-wide rule. The file tree animates measured collection height and entering-row opacity; collapse retains an inert fading snapshot until the height settles. Reduced motion applies structural updates immediately, without relying on View Transitions. Shimmer becomes solid text under reduced motion. Sheet sliding and
segmented-indicator travel are suppressed; direct finger manipulation and the
hold-confirmation timer remain meaningful interaction feedback.
