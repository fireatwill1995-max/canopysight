"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";

interface RiskGaugeProps {
  riskScore: number;
  label?: string;
  size?: number;
}

export function RiskGauge({ riskScore, label = "Risk Score", size = 200 }: RiskGaugeProps) {
  const normalizedScore = Math.max(0, Math.min(100, riskScore));
  const percentage = normalizedScore / 100;
  
  const angle = percentage * 180;
  const radius = size / 2 - 20;
  const centerX = size / 2;
  const centerY = size / 2;

  let color = "#10b981";
  if (normalizedScore > 70) {
    color = "#ef4444";
  } else if (normalizedScore > 40) {
    color = "#f59e0b";
  }

  const startAngle = Math.PI;
  const endAngle = Math.PI - (angle * Math.PI) / 180;
  
  const x1 = centerX + radius * Math.cos(startAngle);
  const y1 = centerY + radius * Math.sin(startAngle);
  const x2 = centerX + radius * Math.cos(endAngle);
  const y2 = centerY + radius * Math.sin(endAngle);
  
  const largeArcFlag = angle > 90 ? 1 : 0;
  const pathData = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${x2} ${y2} Z`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <CardDescription>Current risk assessment</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          <svg width={size} height={size / 2 + 40} className="overflow-visible">
            <path
              d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="20"
            />
            <path
              d={pathData}
              fill={color}
              opacity={0.8}
            />
            <line
              x1={centerX}
              y1={centerY}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx={centerX} cy={centerY} r="8" fill={color} />
            <text x={centerX - radius - 10} y={centerY + 5} fill="#6b7280" fontSize="12">
              0
            </text>
            <text x={centerX} y={centerY - radius - 10} fill="#6b7280" fontSize="12" textAnchor="middle">
              50
            </text>
            <text x={centerX + radius + 10} y={centerY + 5} fill="#6b7280" fontSize="12" textAnchor="end">
              100
            </text>
          </svg>
          <div className="mt-4 text-center">
            <div className="text-4xl font-bold" style={{ color }}>
              {Math.round(normalizedScore)}
            </div>
            <div className="text-sm text-gray-500 mt-1">out of 100</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
