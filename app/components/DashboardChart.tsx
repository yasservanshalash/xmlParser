import React from 'react';
import { 
  Chart, 
  Series, 
  CommonSeriesSettings,
  Legend,
  ValueAxis,
  ArgumentAxis,
  Export,
  Tooltip
} from 'devextreme-react/chart';
import { 
  PieChart, 
  Series as PieSeries,
  Legend as PieLegend,
  Export as PieExport,
  Tooltip as PieTooltip
} from 'devextreme-react/pie-chart';

interface DashboardItem {
  name: string;
  value: number;
  id?: string;
  category?: string;
  color?: string;
}

interface DashboardChartProps {
  items: DashboardItem[];
  type: 'bar' | 'line' | 'pie' | 'spline' | 'area';
  title: string;
  rotated?: boolean;
  height?: number | string;
  width?: number | string;
}

const DashboardChart: React.FC<DashboardChartProps> = ({ 
  items, 
  type, 
  title, 
  rotated = false,
  height = 400,
  width = '100%'
}) => {
  if (!items || items.length === 0) {
    return <div className="no-data">No data available for chart</div>;
  }

  // Render pie chart
  if (type === 'pie') {
    return (
      <div className="chart-wrapper">
        <h2>{title}</h2>
        <PieChart
          id={`pie-chart-${title.toLowerCase().replace(/\s+/g, '-')}`}
          dataSource={items}
          palette="Soft Pastel"
          resolveLabelOverlapping="shift"
          height={height}
          width={width}
        >
          <PieSeries
            argumentField="name"
            valueField="value"
          >
            <PieTooltip enabled={true} customizeTooltip={(arg) => {
              return {
                text: `${arg.argumentText}: ${arg.valueText}`
              };
            }} />
          </PieSeries>
          <PieLegend
            visible={true}
            horizontalAlignment="center"
            verticalAlignment="bottom"
          />
          <PieExport enabled={true} />
        </PieChart>
      </div>
    );
  }

  // Render other chart types (bar, line, spline, area)
  return (
    <div className="chart-wrapper">
      <h2>{title}</h2>
      <Chart
        id={`chart-${title.toLowerCase().replace(/\s+/g, '-')}`}
        dataSource={items}
        rotated={rotated}
        height={height}
        width={width}
      >
        <CommonSeriesSettings
          argumentField="name"
          valueField="value"
          type={type}
        />
        <Series />
        <ArgumentAxis>
          <Tooltip enabled={true} />
        </ArgumentAxis>
        <ValueAxis>
          <Tooltip enabled={true} />
        </ValueAxis>
        <Legend
          visible={true}
          horizontalAlignment="center"
          verticalAlignment="bottom"
        />
        <Tooltip
          enabled={true}
          customizeTooltip={(arg) => {
            return {
              text: `${arg.argumentText}: ${arg.valueText}`
            };
          }}
        />
        <Export enabled={true} />
      </Chart>
    </div>
  );
};

export default DashboardChart; 