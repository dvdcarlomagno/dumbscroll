#!/usr/bin/env swift
import AppKit
import CoreGraphics

// Usage: swift scripts/generate_icons.swift [outputDir] [variant]
// Variants: flat (default), woozy, line, zoned, hypno, xeyes, all (writes <variant>-<size>.png previews)

let arguments = CommandLine.arguments
let outputDirectory = arguments.count > 1
    ? URL(fileURLWithPath: arguments[1], isDirectory: true)
    : URL(fileURLWithPath: "icons/generated", isDirectory: true)
let requestedVariant = arguments.count > 2 ? arguments[2] : "flat"

enum FaceVariant: String, CaseIterable {
    case woozy
    case flat
    case line
    case zoned
    case hypno
    case xeyes
}

struct IconSpec {
    let filename: String
    let pixelSize: Int
}

private let iconSpecs: [IconSpec] = [
    IconSpec(filename: "icon-16.png", pixelSize: 16),
    IconSpec(filename: "icon-32.png", pixelSize: 32),
    IconSpec(filename: "icon-48.png", pixelSize: 48),
    IconSpec(filename: "icon-128.png", pixelSize: 128),
]

private let ink = CGColor(red: 0.067, green: 0.067, blue: 0.067, alpha: 1.0)
private let yellow = CGColor(red: 1.0, green: 0.82, blue: 0.0, alpha: 1.0)

private func drawMasterYellowGradient(in context: CGContext, rect: CGRect) {
    let colors = [
        CGColor(red: 0.93, green: 0.69, blue: 0.0, alpha: 1.0),
        CGColor(red: 1.0, green: 0.82, blue: 0.0, alpha: 1.0),
        CGColor(red: 1.0, green: 0.93, blue: 0.35, alpha: 1.0),
    ] as CFArray
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    guard let gradient = CGGradient(
        colorsSpace: colorSpace,
        colors: colors,
        locations: [0.0, 0.52, 1.0]
    ) else { return }

    context.drawLinearGradient(
        gradient,
        start: CGPoint(x: 0, y: rect.height),
        end: CGPoint(x: rect.width, y: 0),
        options: []
    )
}

// All face geometry lives in a 24x24, y-down grid that mirrors icons/logo.svg.
private func strokeLine(_ context: CGContext, _ points: [CGPoint], width: CGFloat, color: CGColor = yellow) {
    guard let first = points.first else { return }
    context.beginPath()
    context.move(to: first)
    points.dropFirst().forEach { context.addLine(to: $0) }
    context.setLineWidth(width)
    context.setLineCap(.round)
    context.setLineJoin(.round)
    context.setStrokeColor(color)
    context.strokePath()
}

private func wave(from start: CGFloat, to end: CGFloat, y: CGFloat, amplitude: CGFloat) -> [CGPoint] {
    (0...40).map { step in
        let t = CGFloat(step) / 40
        return CGPoint(x: start + t * (end - start), y: y + sin(t * 2 * .pi) * amplitude)
    }
}

private func fillDroopyEye(_ context: CGContext, center: CGPoint, radius: CGFloat, tilt: CGFloat, color: CGColor) {
    context.saveGState()
    context.translateBy(x: center.x, y: center.y)
    context.rotate(by: tilt)
    context.beginPath()
    context.move(to: CGPoint(x: -radius, y: 0))
    context.addArc(center: .zero, radius: radius, startAngle: .pi, endAngle: 0, clockwise: true)
    context.closePath()
    context.setFillColor(color)
    context.fillPath()
    context.restoreGState()
}

private func spiralPoints(center: CGPoint, maxRadius: CGFloat, turns: CGFloat) -> [CGPoint] {
    let steps = 60
    return (0...steps).map { step in
        let t = CGFloat(step) / CGFloat(steps)
        let angle = t * turns * 2 * .pi
        let radius = t * maxRadius
        return CGPoint(x: center.x + cos(angle) * radius, y: center.y + sin(angle) * radius)
    }
}

private func drawFace(_ context: CGContext, variant: FaceVariant, simplified: Bool) {
    if variant != .flat {
        context.setFillColor(ink)
        context.fillEllipse(in: CGRect(x: 4, y: 4, width: 16, height: 16))
    }

    let stroke: CGFloat = simplified ? 1.9 : 1.35
    let leftEye = CGPoint(x: 9.2, y: 10.6)
    let rightEye = CGPoint(x: 14.8, y: 10.6)

    switch variant {
    case .flat:
        // Ink features straight on the yellow tile, no face disc.
        let weight: CGFloat = simplified ? 2.3 : 1.7
        fillDroopyEye(context, center: CGPoint(x: 8.3, y: 9.6), radius: simplified ? 2.6 : 2.4, tilt: -0.28, color: ink)
        strokeLine(context, [CGPoint(x: 17.4, y: 7.9), CGPoint(x: 14.6, y: 9.4), CGPoint(x: 17.1, y: 10.9)], width: weight, color: ink)
        strokeLine(context, wave(from: simplified ? 7.4 : 7.8, to: simplified ? 16.6 : 16.2, y: 15.6, amplitude: simplified ? 0.7 : 0.55), width: weight, color: ink)
    case .line:
        // Same weight everywhere: a drooping lid, a squeezed eye, a wavy mouth.
        strokeLine(context, [CGPoint(x: 7.4, y: 10.9), CGPoint(x: 10.8, y: 9.9)], width: stroke)
        fillDroopyEye(context, center: CGPoint(x: 9.1, y: 10.4), radius: simplified ? 1.4 : 1.15, tilt: -0.28, color: yellow)
        strokeLine(context, [CGPoint(x: 16.4, y: 9.0), CGPoint(x: 14.0, y: 10.2), CGPoint(x: 16.2, y: 11.4)], width: stroke)
        if !simplified {
            strokeLine(context, wave(from: 9.2, to: 14.8, y: 15.2, amplitude: 0.4), width: stroke)
        }
    case .woozy:
        // 🥴, kept calm: one droopy half-open eye, one squeezed eye, a gentle wavy mouth.
        let big: CGFloat = simplified ? 2.3 : 2.2
        let droopy = CGPoint(x: 9.0, y: 10.2)
        context.saveGState()
        context.translateBy(x: droopy.x, y: droopy.y)
        context.rotate(by: -0.3)
        context.beginPath()
        context.move(to: CGPoint(x: -big, y: 0))
        context.addArc(center: .zero, radius: big, startAngle: .pi, endAngle: 0, clockwise: true)
        context.closePath()
        context.setFillColor(yellow)
        context.fillPath()
        context.restoreGState()
        // Squeezed eye: a tight "<" pointing at the nose.
        strokeLine(context, [CGPoint(x: 16.2, y: 8.9), CGPoint(x: 13.9, y: 10.1), CGPoint(x: 15.9, y: 11.3)].map { CGPoint(x: $0.x + (simplified ? 0.2 : 0), y: $0.y) }, width: stroke)
        if !simplified {
            let wobble = (0...32).map { step -> CGPoint in
                let t = CGFloat(step) / 32
                return CGPoint(x: 9.0 + t * 6.0, y: 15.4 + sin(t * 2 * .pi) * 0.35)
            }
            strokeLine(context, wobble, width: stroke)
        }
    case .zoned:
        // Half-lidded eyes: bottom half-discs with a flat lid.
        let radius: CGFloat = simplified ? 2.1 : 1.9
        for eye in [leftEye, rightEye] {
            context.beginPath()
            context.move(to: CGPoint(x: eye.x - radius, y: eye.y))
            context.addArc(center: eye, radius: radius, startAngle: .pi, endAngle: 0, clockwise: true)
            context.closePath()
            context.setFillColor(yellow)
            context.fillPath()
        }
        if !simplified {
            strokeLine(context, [CGPoint(x: 9.4, y: 15.2), CGPoint(x: 13.6, y: 14.9)], width: stroke)
            // Drool drop below the right corner of the mouth.
            context.beginPath()
            context.move(to: CGPoint(x: 13.8, y: 16.1))
            context.addQuadCurve(to: CGPoint(x: 13.2, y: 17.5), control: CGPoint(x: 13.2, y: 16.9))
            context.addArc(center: CGPoint(x: 13.8, y: 17.5), radius: 0.6, startAngle: .pi, endAngle: 0, clockwise: true)
            context.addQuadCurve(to: CGPoint(x: 13.8, y: 16.1), control: CGPoint(x: 14.4, y: 16.9))
            context.setFillColor(yellow)
            context.fillPath()
        }
    case .hypno:
        for eye in [leftEye, rightEye] {
            strokeLine(context, spiralPoints(center: eye, maxRadius: simplified ? 2.0 : 2.1, turns: simplified ? 1.6 : 2.2), width: simplified ? 1.3 : 0.9)
        }
        if !simplified {
            strokeLine(context, [CGPoint(x: 9.5, y: 15.6), CGPoint(x: 14.5, y: 15.6)], width: stroke)
        }
    case .xeyes:
        let arm: CGFloat = simplified ? 1.6 : 1.5
        for eye in [leftEye, rightEye] {
            strokeLine(context, [CGPoint(x: eye.x - arm, y: eye.y - arm), CGPoint(x: eye.x + arm, y: eye.y + arm)], width: stroke)
            strokeLine(context, [CGPoint(x: eye.x - arm, y: eye.y + arm), CGPoint(x: eye.x + arm, y: eye.y - arm)], width: stroke)
        }
        if !simplified {
            let wobble = (0...24).map { step -> CGPoint in
                let t = CGFloat(step) / 24
                return CGPoint(x: 9.0 + t * 6.0, y: 15.5 + sin(t * 3 * .pi) * 0.55)
            }
            strokeLine(context, wobble, width: stroke)
        }
    }
}

private func renderIcon(pixelSize: Int, variant: FaceVariant) -> NSImage {
    let dimension = CGFloat(pixelSize)
    let image = NSImage(size: NSSize(width: dimension, height: dimension))

    image.lockFocus()
    defer { image.unlockFocus() }

    guard let context = NSGraphicsContext.current?.cgContext else { return image }

    let rect = CGRect(x: 0, y: 0, width: dimension, height: dimension)
    let cornerRadius = dimension * 0.224
    let clipPath = NSBezierPath(
        roundedRect: NSRect(origin: .zero, size: NSSize(width: dimension, height: dimension)),
        xRadius: cornerRadius,
        yRadius: cornerRadius
    )
    clipPath.addClip()

    if variant == .flat {
        context.setFillColor(yellow)
        context.fill(rect)
    } else {
        drawMasterYellowGradient(in: context, rect: rect)
    }

    // Small icons get a bigger face so the eyes survive downsampling.
    let simplified = pixelSize <= 16
    let faceScale: CGFloat = variant == .flat ? (simplified ? 1.12 : 1.0) : (simplified ? 1.3 : 1.12)
    context.saveGState()
    context.translateBy(x: 0, y: dimension)
    context.scaleBy(x: dimension / 24, y: -dimension / 24)
    context.translateBy(x: 12, y: 12)
    context.scaleBy(x: faceScale, y: faceScale)
    context.translateBy(x: -12, y: -12)
    drawFace(context, variant: variant, simplified: simplified)
    context.restoreGState()

    return image
}

private func savePNG(_ image: NSImage, to url: URL) throws {
    guard
        let tiff = image.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiff),
        let data = bitmap.representation(using: .png, properties: [:])
    else {
        throw NSError(domain: "DumbscrollIcon", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to encode PNG"])
    }
    try data.write(to: url, options: .atomic)
}

do {
    try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

    if requestedVariant == "all" {
        for variant in FaceVariant.allCases {
            for spec in iconSpecs {
                let image = renderIcon(pixelSize: spec.pixelSize, variant: variant)
                let name = "\(variant.rawValue)-\(spec.pixelSize).png"
                try savePNG(image, to: outputDirectory.appendingPathComponent(name))
            }
        }
    } else {
        guard let variant = FaceVariant(rawValue: requestedVariant) else {
            fputs("Unknown variant \(requestedVariant)\n", stderr)
            exit(1)
        }
        for spec in iconSpecs {
            let image = renderIcon(pixelSize: spec.pixelSize, variant: variant)
            try savePNG(image, to: outputDirectory.appendingPathComponent(spec.filename))
        }
    }

    fputs("Generated Dumbscroll icons in \(outputDirectory.path)\n", stderr)
} catch {
    fputs("Icon generation failed: \(error)\n", stderr)
    exit(1)
}
