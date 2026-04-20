import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';

interface BarChartData {
    value: number;
    label?: string;
    frontColor?: string;
    gradientColor?: string;
    topLabelComponent?: () => React.ReactNode;
}

interface BarChartProps {
    data: BarChartData[];
    width?: number;
    height?: number;
    barWidth?: number;
    spacing?: number;
    maxValue?: number;
    noOfSections?: number;
    roundedTop?: boolean;
    roundedBottom?: boolean;
    frontColor?: string;
    isThreeD?: boolean;
    showYAxisIndices?: boolean;
}

export function BarChart({
    data,
    width = 280,
    height = 150,
    barWidth = 25,
    spacing = 15,
    maxValue,
    noOfSections = 4,
    roundedTop = true,
    roundedBottom = false,
    frontColor = '#6343cc',
    isThreeD = false,
    showYAxisIndices = true,
}: BarChartProps) {
    if (data.length === 0) {
        return (
            <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#8F94A4', fontSize: 12 }}>No data</Text>
            </View>
        );
    }

    const padding = { left: 35, right: 15, top: 25, bottom: 30 };
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate max value
    const dataMax = Math.max(...data.map(d => d.value));
    const max = maxValue || Math.ceil(dataMax / 10) * 10 || 100;

    // Calculate total width needed for bars
    const totalBarsWidth = data.length * barWidth + (data.length - 1) * spacing;
    const startX = padding.left + ((width - padding.left - padding.right - totalBarsWidth) / 2);

    // Bar positions
    const bars = data.map((item, index) => {
        const barHeight = (item.value / max) * chartHeight;
        return {
            x: startX + index * (barWidth + spacing),
            y: padding.top + chartHeight - barHeight,
            width: barWidth,
            height: barHeight,
            value: item.value,
            label: item.label,
            color: item.frontColor || frontColor,
            topLabelComponent: item.topLabelComponent,
        };
    });

    // Y-axis labels
    const yLabels = [];
    for (let i = 0; i <= noOfSections; i++) {
        const value = Math.round((max / noOfSections) * (noOfSections - i));
        const y = padding.top + (chartHeight / noOfSections) * i;
        yLabels.push({ value, y });
    }

    // Calculate border radius
    const borderRadius = Math.min(barWidth / 2, 8);
    const topRadius = roundedTop ? borderRadius : 0;
    const bottomRadius = roundedBottom ? borderRadius : 0;

    // Generate bar path with rounded corners
    const getBarPath = (bar: typeof bars[0]) => {
        const { x, y, width, height } = bar;
        const bottomY = y + height;

        if (height < topRadius + bottomRadius) {
            // Bar too short for rounded corners
            return `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${bottomY} L ${x} ${bottomY} Z`;
        }

        let path = '';

        // Start from bottom-left
        if (bottomRadius > 0) {
            path = `M ${x} ${bottomY - bottomRadius}`;
            path += ` Q ${x} ${bottomY}, ${x + bottomRadius} ${bottomY}`;
            path += ` L ${x + width - bottomRadius} ${bottomY}`;
            path += ` Q ${x + width} ${bottomY}, ${x + width} ${bottomY - bottomRadius}`;
        } else {
            path = `M ${x} ${bottomY}`;
            path += ` L ${x + width} ${bottomY}`;
        }

        // Right side going up
        if (topRadius > 0) {
            path += ` L ${x + width} ${y + topRadius}`;
            path += ` Q ${x + width} ${y}, ${x + width - topRadius} ${y}`;
            path += ` L ${x + topRadius} ${y}`;
            path += ` Q ${x} ${y}, ${x} ${y + topRadius}`;
        } else {
            path += ` L ${x + width} ${y}`;
            path += ` L ${x} ${y}`;
        }

        path += ' Z';
        return path;
    };

    return (
        <View style={{ width, height }}>
            <Svg width={width} height={height}>
                {/* Y-axis grid lines */}
                {yLabels.map((label, i) => (
                    <Line
                        key={`grid-${i}`}
                        x1={padding.left}
                        y1={label.y}
                        x2={width - padding.right}
                        y2={label.y}
                        stroke="#F1F2F6"
                        strokeWidth={1}
                    />
                ))}

                {/* Bars */}
                {bars.map((bar, index) => (
                    <React.Fragment key={index}>
                        {/* 3D effect shadow */}
                        {isThreeD && bar.height > 0 && (
                            <Rect
                                x={bar.x + 3}
                                y={bar.y + 3}
                                width={bar.width}
                                height={bar.height}
                                fill="rgba(0,0,0,0.1)"
                                rx={topRadius}
                                ry={topRadius}
                            />
                        )}
                        {/* Main bar */}
                        {bar.height > 0 && (
                            <Rect
                                x={bar.x}
                                y={bar.y}
                                width={bar.width}
                                height={bar.height}
                                fill={bar.color}
                                rx={topRadius}
                                ry={topRadius}
                            />
                        )}
                    </React.Fragment>
                ))}
            </Svg>

            {/* Y-axis labels */}
            {showYAxisIndices && yLabels.map((label, i) => (
                <Text
                    key={`ylabel-${i}`}
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: label.y - 6,
                        fontSize: 10,
                        color: '#8F94A4',
                        width: padding.left - 5,
                        textAlign: 'right',
                    }}
                >
                    {label.value}
                </Text>
            ))}

            {/* X-axis labels */}
            {bars.map((bar, index) => (
                bar.label && (
                    <Text
                        key={`xlabel-${index}`}
                        style={{
                            position: 'absolute',
                            left: bar.x,
                            top: height - padding.bottom + 8,
                            fontSize: 10,
                            color: '#8F94A4',
                            width: bar.width,
                            textAlign: 'center',
                        }}
                    >
                        {bar.label}
                    </Text>
                )
            ))}

            {/* Top labels */}
            {bars.map((bar, index) => (
                bar.topLabelComponent && bar.height > 0 && (
                    <View
                        key={`toplabel-${index}`}
                        style={{
                            position: 'absolute',
                            left: bar.x,
                            top: bar.y - 20,
                            width: bar.width,
                            alignItems: 'center',
                        }}
                    >
                        {bar.topLabelComponent()}
                    </View>
                )
            ))}
        </View>
    );
}
