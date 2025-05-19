'use client'
import { useState, useEffect, ReactElement } from "react";
// Import DevExtreme components
import { Chart, Series, Legend, ValueAxis, Export, Title } from 'devextreme-react/chart';
import { PieChart, Series as PieSeries } from 'devextreme-react/pie-chart';
import { PivotGrid, FieldChooser } from 'devextreme-react/pivot-grid';
import PivotGridDataSource from 'devextreme/ui/pivot_grid/data_source';
import 'devextreme/dist/css/dx.light.css';
import FinancialData from "@/public/data.json";

// Import types from DevExtreme
import { SeriesType } from 'devextreme/viz/chart';

// Define type for financial data items
type FinancialRecord = {
  CompGroupId: string;
  DocDt: string;
  GLCode: string;
  ACCCompId: string;
  Amount: string;
};

// Define type for chart data structures
type ChartConfig = {
  $?: {
    Name?: string;
    Type?: string;
    ValueAxisTitle?: string;
    Rotated?: string;
    [key: string]: unknown;
  };
  data?: unknown[];
  Panes?: {
    Pane?: {
      $?: { Name?: string };
      Series?: {
        Simple?: {
          $?: { SeriesType?: string };
          Value?: unknown[];
        }[];
      }[];
    }[];
  }[];
  [key: string]: unknown;
};

type DashboardData = {
  Chart?: ChartConfig[];
  Pie?: ChartConfig[];
  Pivot?: ChartConfig[];
  [key: string]: unknown;
};

// Define types for processed data
type ChartDataItem = {
  argument: string;
  value: number;
};

type ProcessedData = {
  byGLCode: ChartDataItem[];
  byCompGroup: ChartDataItem[];
  byACCCompId: ChartDataItem[];
  byMonthYear: Record<string, Record<string, number>>;
  rawData: FinancialRecord[];
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  
  // Process financial data
  useEffect(() => {
    try {
      console.log("Processing financial data:", FinancialData.length, "records");
      
      // Group data by GLCode
      const glCodeTotals = FinancialData.reduce((acc: Record<string, number>, item: FinancialRecord) => {
        const glCode = item.GLCode;
        const amount = parseFloat(item.Amount);
        
        if (!isNaN(amount)) {
          if (!acc[glCode]) {
            acc[glCode] = 0;
          }
          acc[glCode] += amount;
        }
        
        return acc;
      }, {});
      
      // Convert to array format for Chart
      const byGLCode = Object.keys(glCodeTotals).map(glCode => ({
        argument: glCode,
        value: glCodeTotals[glCode]
      })).sort((a, b) => b.value - a.value);
      
      // Group data by CompGroupId
      const compGroupTotals = FinancialData.reduce((acc: Record<string, number>, item: FinancialRecord) => {
        const compGroup = item.CompGroupId;
        const amount = parseFloat(item.Amount);
        
        if (!isNaN(amount)) {
          if (!acc[compGroup]) {
            acc[compGroup] = 0;
          }
          acc[compGroup] += amount;
        }
        
        return acc;
      }, {});
      
      // Convert to array format
      const byCompGroup = Object.keys(compGroupTotals).map(compGroup => ({
        argument: compGroup,
        value: compGroupTotals[compGroup]
      }));
      
      // Group data by ACCCompId
      const accCompTotals = FinancialData.reduce((acc: Record<string, number>, item: FinancialRecord) => {
        const accCompId = item.ACCCompId;
        const amount = parseFloat(item.Amount);
        
        if (!isNaN(amount)) {
          if (!acc[accCompId]) {
            acc[accCompId] = 0;
          }
          acc[accCompId] += amount;
        }
        
        return acc;
      }, {});
      
      // Convert to array format
      const byACCCompId = Object.keys(accCompTotals).map(accCompId => ({
        argument: accCompId,
        value: accCompTotals[accCompId]
      })).sort((a, b) => b.value - a.value);
      
      // Process data by month and year
      const byMonthYear: Record<string, Record<string, number>> = {};
      
      FinancialData.forEach((item: FinancialRecord) => {
        const amount = parseFloat(item.Amount);
        if (isNaN(amount)) return;
        
        const date = new Date(item.DocDt);
        if (isNaN(date.getTime())) return;
        
        const year = date.getFullYear().toString();
        const month = date.toLocaleString('default', { month: 'short' });
        
        if (!byMonthYear[year]) {
          byMonthYear[year] = {};
        }
        
        if (!byMonthYear[year][month]) {
          byMonthYear[year][month] = 0;
        }
        
        byMonthYear[year][month] += amount;
      });
      
      setProcessedData({
        byGLCode,
        byCompGroup,
        byACCCompId,
        byMonthYear,
        rawData: FinancialData
      });
    } catch (err) {
      console.error('Error processing financial data:', err);
      setError("Failed to process financial data");
    }
  }, []);
  
  // Fetch chart configuration from API
  useEffect(() => {
    setLoading(true);
    fetch('/api/parse-xml')
      .then((res) => res.json())
      .then((data) => {
        console.log("Raw API response:", data);
        // Check if data has the expected structure
        if (data && data.Dashboard && data.Dashboard.Items) {
          setDashboardData(data.Dashboard.Items[0]);
        } else {
          console.error("Unexpected data structure:", data);
          setError("Unexpected data structure received from API");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Fetch error:', err);
        setError("Failed to fetch data");
        setLoading(false);
      });
  }, []);

  // Function to extract series type from chart configuration
  const getSeriesType = (chart: ChartConfig): SeriesType => {
    console.log("Chart configuration:", chart);
    
    try {
      // Try to extract series type from the Panes structure
      if (chart.Panes && 
          Array.isArray(chart.Panes) && 
          chart.Panes[0] && 
          chart.Panes[0].Pane && 
          Array.isArray(chart.Panes[0].Pane) && 
          chart.Panes[0].Pane[0] && 
          chart.Panes[0].Pane[0].Series && 
          Array.isArray(chart.Panes[0].Pane[0].Series) && 
          chart.Panes[0].Pane[0].Series[0] && 
          chart.Panes[0].Pane[0].Series[0].Simple && 
          Array.isArray(chart.Panes[0].Pane[0].Series[0].Simple) && 
          chart.Panes[0].Pane[0].Series[0].Simple[0] && 
          chart.Panes[0].Pane[0].Series[0].Simple[0].$ && 
          chart.Panes[0].Pane[0].Series[0].Simple[0].$.SeriesType) {
        
        const seriesType = chart.Panes[0].Pane[0].Series[0].Simple[0].$.SeriesType.toLowerCase();
        console.log("Found series type in configuration:", seriesType);
        
        // Map the XML series type to a valid DevExtreme series type
        switch (seriesType) {
          case 'spline':
            return 'spline';
          case 'line':
            return 'line';
          case 'bar':
            return 'bar';
          case 'area':
            return 'area';
          case 'stackedbar':
            return 'stackedbar';
          case 'fullstackedbar':
            return 'fullstackedbar';
          default:
            return 'bar';
        }
      }
    } catch (error) {
      console.error("Error extracting series type:", error);
    }
    
    // If we can't find the series type or there's an error, use a default
    return chart.$ && chart.$.Type ? 
      (chart.$.Type.toLowerCase() === 'spline' ? 'spline' : 'bar') : 'bar';
  };

  // Function to render charts based on their type
  const renderCharts = () => {
    if (loading) return <div className="p-4">Loading charts...</div>;
    if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
    if (!dashboardData || !processedData) return <div className="p-4">No data available</div>;
    
    console.log("Rendering dashboard with configuration from XML and data from data.json");
    
    const chartElements: ReactElement[] = [];
    
    // Process Chart type
    if (dashboardData.Chart && Array.isArray(dashboardData.Chart)) {
      console.log(`Found ${dashboardData.Chart.length} Chart items`);
      
      dashboardData.Chart.forEach((chart, index) => {
        const chartConfig = chart.$ || {};
        let chartData;
        
        // Get series type from configuration
        const seriesType = getSeriesType(chart);
        
        // Use the appropriate data for this chart based on its name or other attributes
        if (chartConfig.Name?.includes("Revenue By Year Division")) {
          chartData = processedData.byCompGroup;
        } else if (chartConfig.Name?.includes("Periodic Revenue")) {
          // Convert month-year data to series format for the line chart
          const lineChartData: ChartDataItem[] = [];
          Object.keys(processedData.byMonthYear).forEach(year => {
            Object.keys(processedData.byMonthYear[year]).forEach(month => {
              lineChartData.push({
                argument: `${month} ${year}`,
                value: processedData.byMonthYear[year][month]
              });
            });
          });
          chartData = lineChartData;
        } else {
          // Default to GL Code data
          chartData = processedData.byGLCode.slice(0, 10); // Top 10 GL codes
        }
        
        chartElements.push(
          <div key={`chart-${index}`} className="mb-8 p-4 border rounded shadow-md">
            <Chart
              id={`chart-${index}`}
              dataSource={chartData}
              palette="Harmony Light"
              rotated={chartConfig.Rotated === 'true'}
            >
              <Title text={chartConfig.Name || 'Chart'} />
              <Legend visible={true} />
              <Series
                valueField="value"
                argumentField="argument"
                type={seriesType}
                name={chartConfig.Name || 'Data Series'}
              />
              <ValueAxis title={{ text: chartConfig.ValueAxisTitle || 'Amount' }} />
              <Export enabled={true} />
            </Chart>
          </div>
        );
      });
    }
    
    // Process Pie type
    if (dashboardData.Pie && Array.isArray(dashboardData.Pie)) {
      console.log(`Found ${dashboardData.Pie.length} Pie items`);
      
      dashboardData.Pie.forEach((pie, index) => {
        const pieConfig = pie.$ || {};
        // Use company group data for pie charts
        const pieData = processedData.byCompGroup;
        
        chartElements.push(
          <div key={`pie-${index}`} className="mb-8 p-4 border rounded shadow-md">
            <PieChart
              id={`pie-${index}`}
              dataSource={pieData}
              palette="Bright"
              title={pieConfig.Name || 'Company Distribution'}
              resolveLabelOverlapping="shift"
            >
              <PieSeries
                argumentField="argument"
                valueField="value"
              />
              <Legend visible={true} margin={{ top: 20 }} />
              <Export enabled={true} />
            </PieChart>
          </div>
        );
      });
    }
    
    // Process Pivot type
    if (dashboardData.Pivot && Array.isArray(dashboardData.Pivot)) {
      console.log(`Found ${dashboardData.Pivot.length} Pivot items`);
      
      dashboardData.Pivot.forEach((pivot, index) => {
        const pivotConfig = pivot.$ || {};
        
        // Create a pivot data source
        const pivotDataSource = new PivotGridDataSource({
          store: processedData.rawData,
          fields: [
            { 
              dataField: 'CompGroupId',
              area: 'row'
            },
            { 
              dataField: 'DocDt',
              area: 'column',
              groupInterval: 'month'
            },
            { 
              dataField: 'Amount',
              dataType: 'number',
              summaryType: 'sum',
              area: 'data'
            },
            {
              dataField: 'GLCode',
              area: 'filter'
            }
          ]
        });
        
        chartElements.push(
          <div key={`pivot-${index}`} className="mb-8 p-4 border rounded shadow-md lg:col-span-2">
            <h2 className="text-xl font-bold mb-2">{pivotConfig.Name || 'Financial Analysis'}</h2>
            <PivotGrid
              id={`pivot-${index}`}
              dataSource={pivotDataSource}
              allowSortingBySummary={true}
              allowSorting={true}
              allowFiltering={true}
              allowExpandAll={true}
              height={400}
              showBorders={true}
            >
              <FieldChooser enabled={true} />
            </PivotGrid>
          </div>
        );
      });
    }
    
    return chartElements.length > 0 ? chartElements : <div>No charts found in the data</div>;
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Financial Dashboard</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderCharts()}
      </div>
    </div>
  );
}
