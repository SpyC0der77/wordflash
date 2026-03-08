import SwiftUI

struct WordFlowLayout: Layout {
    var horizontalSpacing: CGFloat = 0
    var verticalSpacing: CGFloat = 6

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        let sizes = subviews.map { $0.sizeThatFits(ProposedViewSize(width: maxWidth, height: nil)) }
        let frames = computeFrames(for: sizes, maxWidth: maxWidth)

        let width = frames.map(\.maxX).max() ?? 0
        let height = frames.map(\.maxY).max() ?? 0
        return CGSize(width: width, height: height)
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        let maxWidth = bounds.width
        let sizes = subviews.map { $0.sizeThatFits(ProposedViewSize(width: maxWidth, height: nil)) }
        let frames = computeFrames(for: sizes, maxWidth: maxWidth)

        for (index, frame) in frames.enumerated() {
            guard index < subviews.count else { continue }
            let point = CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY)
            subviews[index].place(
                at: point,
                anchor: .topLeading,
                proposal: ProposedViewSize(width: frame.width, height: frame.height)
            )
        }
    }

    private func computeFrames(for sizes: [CGSize], maxWidth: CGFloat) -> [CGRect] {
        guard !sizes.isEmpty else { return [] }

        var frames: [CGRect] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var lineHeight: CGFloat = 0

        for size in sizes {
            if x > 0 && x + size.width > maxWidth {
                x = 0
                y += lineHeight + verticalSpacing
                lineHeight = 0
            }

            let frame = CGRect(origin: CGPoint(x: x, y: y), size: size)
            frames.append(frame)

            x += size.width + horizontalSpacing
            lineHeight = max(lineHeight, size.height)
        }

        return frames
    }
}
