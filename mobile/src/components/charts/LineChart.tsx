import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';

interface LineChartData {
    value: number;
    label?: string;
}

interface LineChartProps {
    data: LineChartData[];
    width?: number;
    height?: number;
    color?: string;
    areaChart?: boolean;
    curved?: boolean;
    showDataPoints?: boolean;
    maxValue?: number;
    noOfSections?: number;
}

export function LineChart({
    data,
    width = 280,
    height = 150,
    color = '#6343cc',
    areaChart = true,
    curved = true,
    showDataPoints = true,
    maxValue,
    noOfSections = 4,
}: LineChartProps) {
    if (data.length === 0) {
        return (
            <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#8F94A4', fontSize: 12 }}>No data</Text>
            </View>
        );
    }

    const padding = { left: 35, right: 15, top: 15, bottom: 30 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate max value
    const dataMax = Math.max(...data.map(d => d.value));
    const max = maxValue || Math.ceil(dataMax / 10) * 10 || 100;

    // Calculate points
    const points = data.map((item, index) => ({
        x: padding.left + (index / (data.length - 1 || 1)) * chartWidth,
        y: padding.top + chartHeight - (item.value / max) * chartHeight,
        value: item.value,
        label: item.label,
    }));

    // Generate path
    let linePath = '';
    let areaPath = '';

    if (curved && points.length > 1) {
        // Bezier curve
        linePath = `M ${points[0].x} ${points[0].y}`;
        areaPath = `M ${points[0].x} ${padding.top + chartHeight} L ${points[0].x} ${points[0].y}`;

        for (let i = 0; i < points.length - 1; i++) {
            const current = points[i];
            const next = points[i + 1];
            const midX = (current.x + next.x) / 2;

            linePath += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
            areaPath += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
        }

        areaPath += ` L ${points[points.length - 1].x} ${padding.top + chartHeight} Z`;
    } else {
        // Straight lines
        linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        areaPath = `M ${points[0].x} ${padding.top + chartHeight} ` +
            points.map(p => `L ${p.x} ${p.y}`).join(' ') +
            ` L ${points[points.length - 1].x} ${padding.top + chartHeight} Z`;
    }

    // Y-axis labels
    const yLabels = [];
    for (let i = 0; i <= noOfSections; i++) {
        const value = Math.round((max / noOfSections) * (noOfSections - i));
        const y = padding.top + (chartHeight / noOfSections) * i;
        yLabels.push({ value, y });
    }

    return (
        <View style={{ width, height }}>
            <Svg width={width} height={height}>
                <Defs>
                    <LinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={color} stopOpacity="0.3" />
                        <Stop offset="1" stopColor={color} stopOpacity="0.05" />
                    </LinearGradient>
                </Defs>

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

                {/* Area fill */}
                {areaChart && (
                    <Path d={areaPath} fill="url(#areaGradient)" />
                )}

                {/* Line */}
                <Path
                    d={linePath}
                    stroke={color}
                    strokeWidth={3}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Data points */}
                {showDataPoints && points.map((point, index) => (
                    <Circle
                        key={index}
                        cx={point.x}
                        cy={point.y}
                        r={4}
                        fill="#fff"
                        stroke={color}
                        strokeWidth={2}
                    />
                ))}
            </Svg>

            {/* Y-axis labels */}
            {yLabels.map((label, i) => (
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
            {points.map((point, index) => (
                point.label && (
                    <Text
                        key={`xlabel-${index}`}
                        style={{
                            position: 'absolute',
                            left: point.x - 15,
                            top: height - padding.bottom + 8,
                            fontSize: 10,
                            color: '#8F94A4',
                            width: 30,
                            textAlign: 'center',
                        }}
                    >
                        {point.label}
                    </Text>
                )
            ))}
        </View>
    );
}
