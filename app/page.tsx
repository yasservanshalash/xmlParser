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
    ComponentName?: string;
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

// Define types for layout information
type LayoutItem = {
  $?: {
    DashboardItem?: string;
    Weight?: string;
  };
};

type LayoutGroup = {
  $?: {
    Orientation?: string;
    Weight?: string;
  };
  LayoutItem?: LayoutItem[];
  LayoutGroup?: LayoutGroup[];
};

// Define types for API response
type ApiResponse = {
  Dashboard?: {
    Items?: DashboardData[];
    LayoutTree?: {
      LayoutGroup?: LayoutGroup[];
    }[];
  };
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

// Define type for chart position and size
type ChartLayout = {
  componentName: string;
  width: number;
  height: number;
  x: number;
  y: number;
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [layoutData, setLayoutData] = useState<ChartLayout[]>([]);
  
  // Define the specific order for CompGroupId values
  const compGroupOrder = ["ASP", "OTH", "PC", "RMX"];
  
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
      
      // Convert to array format with specific order
      const byCompGroup = compGroupOrder
        .filter(compGroup => compGroupTotals[compGroup] !== undefined)
        .map(compGroup => ({
          argument: compGroup,
          value: compGroupTotals[compGroup]
        }));
      
      // Add any other CompGroupIds that might not be in the predefined order
      Object.keys(compGroupTotals)
        .filter(compGroup => !compGroupOrder.includes(compGroup))
        .forEach(compGroup => {
          byCompGroup.push({
            argument: compGroup,
            value: compGroupTotals[compGroup]
          });
        });
      
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
      .then((data: ApiResponse) => {
        console.log("Raw API response:", data);
        // Check if data has the expected structure
        if (data && data.Dashboard && data.Dashboard.Items) {
          setDashboardData(data.Dashboard.Items[0]);
          
          // Process layout data if available
          if (data.Dashboard.LayoutTree && data.Dashboard.LayoutTree[0] && 
              data.Dashboard.LayoutTree[0].LayoutGroup) {
            processLayoutData(data.Dashboard.LayoutTree[0], data.Dashboard.Items[0]);
          } else {
            console.warn("Layout information not found in XML");
          }
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

  // Function to process layout data from the XML
  const processLayoutData = (layoutTree: { LayoutGroup?: LayoutGroup[] }, items: DashboardData) => {
    console.log("Processing layout data:", layoutTree);
    
    const componentMap = new Map<string, string>();
    
    // Create a map of component names to item types
    Object.keys(items).forEach(itemType => {
      if (Array.isArray(items[itemType as keyof DashboardData])) {
        (items[itemType as keyof DashboardData] as ChartConfig[]).forEach((item: ChartConfig) => {
          if (item.$ && item.$.ComponentName) {
            componentMap.set(item.$.ComponentName, itemType);
          }
        });
      }
    });
    
    const layouts: ChartLayout[] = [];
    const containerWidth = 1200; // Default container width
    const containerHeight = 800; // Default container height
    
    // Helper function to recursively process layout groups
    const processLayoutGroup = (
      group: LayoutGroup, 
      parentX: number = 0, 
      parentY: number = 0, 
      parentWidth: number = containerWidth, 
      parentHeight: number = containerHeight
    ) => {
      const orientation = group.$?.Orientation?.toLowerCase();
      const horizontal = orientation !== 'vertical';
      
      let currentPosition = 0;
      const totalWeight = calculateTotalWeight(group);
      
      // Process layout items
      if (group.LayoutItem && Array.isArray(group.LayoutItem)) {
        group.LayoutItem.forEach(item => {
          if (item.$ && item.$.DashboardItem) {
            const weight = parseFloat(item.$.Weight || "0") / totalWeight;
            const itemWidth = horizontal ? parentWidth * weight : parentWidth;
            const itemHeight = horizontal ? parentHeight : parentHeight * weight;
            
            const x = horizontal ? parentX + currentPosition : parentX;
            const y = horizontal ? parentY : parentY + currentPosition;
            
            layouts.push({
              componentName: item.$.DashboardItem,
              width: itemWidth,
              height: itemHeight,
              x,
              y
            });
            
            currentPosition += horizontal ? itemWidth : itemHeight;
          }
        });
      }
      
      // Process nested layout groups
      if (group.LayoutGroup && Array.isArray(group.LayoutGroup)) {
        group.LayoutGroup.forEach(childGroup => {
          const weight = parseFloat(childGroup.$?.Weight || "0") / totalWeight;
          const groupWidth = horizontal ? parentWidth * weight : parentWidth;
          const groupHeight = horizontal ? parentHeight : parentHeight * weight;
          
          const x = horizontal ? parentX + currentPosition : parentX;
          const y = horizontal ? parentY : parentY + currentPosition;
          
          processLayoutGroup(
            childGroup,
            x,
            y,
            groupWidth,
            groupHeight
          );
          
          currentPosition += horizontal ? groupWidth : groupHeight;
        });
      }
    };
    
    // Helper function to calculate total weight
    const calculateTotalWeight = (group: LayoutGroup): number => {
      let totalWeight = 0;
      
      if (group.LayoutItem && Array.isArray(group.LayoutItem)) {
        group.LayoutItem.forEach(item => {
          if (item.$ && item.$.Weight) {
            totalWeight += parseFloat(item.$.Weight);
          }
        });
      }
      
      if (group.LayoutGroup && Array.isArray(group.LayoutGroup)) {
        group.LayoutGroup.forEach(childGroup => {
          if (childGroup.$ && childGroup.$.Weight) {
            totalWeight += parseFloat(childGroup.$.Weight);
          }
        });
      }
      
      return totalWeight > 0 ? totalWeight : 100;
    };
    
    // Start processing from the root layout group
    if (layoutTree.LayoutGroup && Array.isArray(layoutTree.LayoutGroup)) {
      layoutTree.LayoutGroup.forEach((group: LayoutGroup) => {
        processLayoutGroup(group);
      });
    }
    
    console.log("Generated layout data:", layouts);
    setLayoutData(layouts);
  };

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

  // Function to get layout for a specific component
  const getLayoutForComponent = (componentName: string): ChartLayout | undefined => {
    return layoutData.find(layout => layout.componentName === componentName);
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
        
        // Get layout information for this chart
        const layout = chartConfig.ComponentName 
          ? getLayoutForComponent(chartConfig.ComponentName)
          : undefined;
        
        const chartStyle = layout ? {
          position: 'absolute' as const,
          left: `${layout.x}px`,
          top: `${layout.y}px`,
          width: `${layout.width}px`,
          height: `${layout.height}px`,
        } : {
          marginBottom: '2rem',
          padding: '1rem'
        };
        
        chartElements.push(
          <div 
            key={`chart-${index}`} 
            className="border rounded shadow-md"
            style={chartStyle}
          >
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
        
        // Get layout information for this pie chart
        const layout = pieConfig.ComponentName 
          ? getLayoutForComponent(pieConfig.ComponentName)
          : undefined;
        
        const pieStyle = layout ? {
          position: 'absolute' as const,
          left: `${layout.x}px`,
          top: `${layout.y}px`,
          width: `${layout.width}px`,
          height: `${layout.height}px`,
        } : {
          marginBottom: '2rem',
          padding: '1rem'
        };
        
        chartElements.push(
          <div 
            key={`pie-${index}`} 
            className="border rounded shadow-md"
            style={pieStyle}
          >
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
        
        // Get layout information for this pivot grid
        const layout = pivotConfig.ComponentName 
          ? getLayoutForComponent(pivotConfig.ComponentName)
          : undefined;
        
        const pivotStyle = layout ? {
          position: 'absolute' as const,
          left: `${layout.x}px`,
          top: `${layout.y}px`,
          width: `${layout.width}px`,
          height: `${layout.height}px`,
        } : {
          marginBottom: '2rem',
          padding: '1rem'
        };
        
        chartElements.push(
          <div 
            key={`pivot-${index}`} 
            className="border rounded shadow-md"
            style={pivotStyle}
          >
            <h2 className="text-xl font-bold mb-2">{pivotConfig.Name || 'Financial Analysis'}</h2>
            <PivotGrid
              id={`pivot-${index}`}
              dataSource={pivotDataSource}
              allowSortingBySummary={true}
              allowSorting={true}
              allowFiltering={true}
              allowExpandAll={true}
              height={layout ? layout.height - 50 : 400}
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
      
      <div className="relative" style={{ minHeight: '800px' }}>
        {renderCharts()}
      </div>
    </div>
  );
}
