import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

interface PieChartData {
    value: number;
    color: string;
    text?: string;
}

interface PieChartProps {
    data: PieChartData[];
    radius?: number;
    innerRadius?: number;
    centerLabelComponent?: () => React.ReactNode;
}

export function PieChart({
    data,
    radius = 70,
    innerRadius = 45,
    centerLabelComponent,
}: PieChartProps) {
    const total = data.reduce((sum, item) => sum + item.value, 0);

    if (total === 0) {
        return (
            <View style={{ width: radius * 2, height: radius * 2, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#8F94A4', fontSize: 12 }}>No data</Text>
            </View>
        );
    }

    const size = radius * 2;
    const center = radius;

    // Calculate paths for each segment
    let currentAngle = -90; // Start from top
    const segments = data.map((item, index) => {
        const percentage = item.value / total;
        const angle = percentage * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        currentAngle = endAngle;

        // Convert angles to radians
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        // Calculate outer arc points
        const x1 = center + radius * Math.cos(startRad);
        const y1 = center + radius * Math.sin(startRad);
        const x2 = center + radius * Math.cos(endRad);
        const y2 = center + radius * Math.sin(endRad);

        // Calculate inner arc points
        const x3 = center + innerRadius * Math.cos(endRad);
        const y3 = center + innerRadius * Math.sin(endRad);
        const x4 = center + innerRadius * Math.cos(startRad);
        const y4 = center + innerRadius * Math.sin(startRad);

        const largeArc = angle > 180 ? 1 : 0;

        // Create donut segment path
        const path = `
            M ${x1} ${y1}
            A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
            L ${x3} ${y3}
            A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}
            Z
        `;

        return (
            <Path
                key={index}
                d={path}
                fill={item.color}
            />
        );
    });

    return (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'relative' }}>
                <Svg width={size} height={size}>
                    <G>{segments}</G>
                </Svg>
                {centerLabelComponent && (
                    <View
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {centerLabelComponent()}
                    </View>
                )}
            </View>
        </View>
    );
}
