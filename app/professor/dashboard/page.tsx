"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { DateRange } from "react-day-picker";
import { addDays, format, isWithinInterval, startOfDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { getCurrentSemester, getSemesterDateRange, getSemesterFromDate, type SemesterCode } from "@/lib/semester";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Feedback {
  _id: string;
  taName: string;
  courseCode: string;
  date: string;
  attendanceCount: number;
  studentEngagement: number;
  topicsCovered: string[];
  overview: string;
  suggestions?: string;
  needsAttention: boolean;
  sentimentScore?: number;
  sentimentLabel?: 'positive' | 'neutral' | 'negative';
  semester?: string;
  year?: number;
}

//TODO: prof should be able to dismiss urgent matters and they should be removed from db
//TODO: summarize entries from most recent date
export default function ProfessorDashboard() {
  const [professorName, setProfessorName] = useState("Elias Gonzalez");
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false); // only fetch summary when ready
  const currentSemester = getCurrentSemester();
  const [selectedSemester, setSelectedSemester] = useState<SemesterCode | "all">(currentSemester);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  const [lastClassSummary, setLastClassSummary] = useState<string>(""); // to concat recent feedbacks and call api on

  // Get available semesters from feedback data (use stored semester/year fields)
  const availableSemesters = useMemo(() => {
    const semesterSet = new Set<string>();
    feedbacks.forEach(f => {
      if (f.semester && f.year) {
        semesterSet.add(`${f.semester} ${f.year}`);
      }
    });
    // Also add semesters calculated from dates for backwards compatibility
    feedbacks.forEach(f => {
      const dateSemester = getSemesterFromDate(new Date(f.date));
      semesterSet.add(dateSemester);
    });
    return Array.from(semesterSet).sort().reverse(); // Most recent first
  }, [feedbacks]);

  // First, fetch all feedbacks to populate available semesters
  useEffect(() => {
    const fetchAllFeedbacks = async () => {
      try {
        const params = new URLSearchParams({
          professorName: professorName,
          courseCode: "CMSC131",
        });
        const response = await fetch(`/api/feedback?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          // Update available semesters from all feedbacks
          const semesterSet = new Set<string>();
          data.forEach((f: Feedback) => {
            if (f.semester && f.year) {
              semesterSet.add(`${f.semester} ${f.year}`);
            }
          });
        }
      } catch (error) {
        console.error("Error fetching all feedbacks:", error);
      }
    };

    if (professorName) {
      fetchAllFeedbacks();
    }
  }, [professorName]);

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        setLoading(true);
        // Build query params
        const params = new URLSearchParams({
          professorName: professorName,
          courseCode: "CMSC131",
        });
        
        if (selectedSemester !== "all") {
          const [semester, year] = selectedSemester.split(' ');
          params.append('semester', semester);
          params.append('year', year);
          console.log('Filtering by semester:', semester, 'year:', year);
        }
        
        const response = await fetch(`/api/feedback?${params.toString()}`);
        if (!response.ok) throw new Error("Failed to fetch feedback");
        const data = await response.json();
        console.log('Fetched feedbacks:', data.length, 'items');
        if (data.length > 0) {
          console.log('Sample feedback:', { 
            semester: data[0].semester, 
            year: data[0].year,
            date: data[0].date
          });
        }
        setFeedbacks(data);
      } catch (error) {
        console.error("Error fetching feedback:", error);
      } finally {
        setLoading(false);
      }
    };

    if (professorName) {
      fetchFeedback();
    }
  }, [professorName, selectedSemester]);

  // Update date range when semester changes
  useEffect(() => {
    if (selectedSemester !== "all") {
      const { start, end } = getSemesterDateRange(selectedSemester);
      setDateRange({ from: start, to: end });
    }
  }, [selectedSemester]);

  // FIXME show sorted, with Urgent ones first
  // only show data based on range selected
  const sortedFeedbacks = useMemo(() => {
    //useMemo hook only recalculates values when date range changes
    return feedbacks
      .filter((feedback) => {
        if (!dateRange?.from || !dateRange?.to) return true;
        const feedbackDate = startOfDay(new Date(feedback.date));
        return isWithinInterval(feedbackDate, {
          start: startOfDay(dateRange.from),
          end: startOfDay(dateRange.to),
        });
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [feedbacks, dateRange]);

  // TODO get most recent only
  const getAllFeedbackText = (feedbacks: Feedback[]) => {
    // Check if feedbacks array exists and has items
    if (!feedbacks || feedbacks.length === 0) return "";
    
    // Safely map and join the feedbacks with null checks
    return feedbacks
      .filter(f => f && f.taName && f.overview) // Ensure required fields exist
      .map(f => `Student ${f.taName}: ${f.overview}`)
      .join(" ");
  };
  
  const fetchSummary = async (feedbackText: string) => {
    try {
      // Don't make the API call if there's no text to summarize
      if (!feedbackText.trim()) {
        setLastClassSummary("Loading summary...");
        return;
      }
  
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          feedbackText,
          // Add a safety check property
          hasFeedback: true 
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.summary) {
        // If there's an error message in the response, show it
        if (data?.error) {
          throw new Error(data.error);
        }
        throw new Error("Invalid response format");
      }
      
      setLastClassSummary(data.summary);
    } catch (error) {
      console.error("Error fetching summary:", error);
      // Show the actual error message if available
      const errorMessage = error instanceof Error ? error.message : "Unable to generate summary at this time.";
      setLastClassSummary(`Error: ${errorMessage}`);
    }
  };

  // Add a delay check effect
  useEffect(() => {
    if (sortedFeedbacks && sortedFeedbacks.length > 0 && !dataReady) {
      // Wait 3 seconds after initial data load before marking as ready
      const timer = setTimeout(() => {
        setDataReady(true);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [dataReady, sortedFeedbacks]);

  // Modify the summary effect to depend on dataReady
  useEffect(() => {
    if (!dataReady) {
      setLastClassSummary("Loading summary...");
      return;
    }

    if (sortedFeedbacks && sortedFeedbacks.length > 0) {
      const feedbackText = getAllFeedbackText(sortedFeedbacks);
      fetchSummary(feedbackText);
    } else {
      setLastClassSummary("No feedback available");
    }
  }, [sortedFeedbacks, dataReady]);

  const engagementData = useMemo(() => {
    const dateMap: {
      [key: string]: { engagement: number; attendance: number; count: number };
    } = {};

    sortedFeedbacks.forEach((feedback) => {
      const date = format(new Date(feedback.date), "MMM d");
      if (!dateMap[date]) {
        dateMap[date] = {
          engagement: 0,
          attendance: 0,
          count: 0,
        };
      }
      dateMap[date].engagement += feedback.studentEngagement;
      dateMap[date].attendance += feedback.attendanceCount;
      dateMap[date].count += 1;
    });

    return Object.keys(dateMap)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map((date) => ({
        date,
        engagement: dateMap[date].engagement / dateMap[date].count,
        attendance: dateMap[date].attendance / dateMap[date].count,
      }));
  }, [sortedFeedbacks]);

  const urgentFeedbacks = useMemo(() => {
    return sortedFeedbacks.filter((f) => f.needsAttention);
  }, [sortedFeedbacks]);

  const averageEngagement = useMemo(() => {
    return sortedFeedbacks.length
      ? sortedFeedbacks.reduce((acc, curr) => acc + curr.studentEngagement, 0) /
          sortedFeedbacks.length
      : 0;
  }, [sortedFeedbacks]);

  const handleDeleteFeedback = async (id: string) => {
    try {
      const response = await fetch(`/api/feedback?id=${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete feedback");
      }
      setFeedbacks((prev) => prev.filter((f) => f._id !== id));
    } catch (error) {
      console.error("Error deleting feedback:", error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center text-primary hover:text-primary/90 mb-6"
      >
        <ChevronLeft className="h-4 w-4 mr-2" />
        Back to Home
      </Link>

      <div className="flex justify-between items-center mb-8">
        <div className="flex gap-4 items-end">
          <div>
            <h1 className="text-3xl font-bold mb-2">Professor Dashboard</h1>
            <div className="flex gap-2">
              <Select onValueChange={setProfessorName} value={professorName}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select professor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Elias Gonzalez">Elias Gonzalez</SelectItem>
                  <SelectItem value="Pedram Sadeghian">Pedram Sadeghian</SelectItem>
                </SelectContent>
              </Select>
              
              <Select onValueChange={(value) => setSelectedSemester(value as SemesterCode | "all")} value={selectedSemester}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Semesters</SelectItem>
                  {availableSemesters.map((semester) => (
                    <SelectItem key={semester} value={semester}>
                      {semester}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
            >
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} -{" "}
                    {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Urgent Matters</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">
              {urgentFeedbacks.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avg. Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {averageEngagement.toFixed(1)}/5
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avg. Sentiment</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const feedbacksWithSentiment = sortedFeedbacks.filter(f => f.sentimentScore !== undefined);
              const avgSentiment = feedbacksWithSentiment.length > 0
                ? feedbacksWithSentiment.reduce((acc, curr) => acc + (curr.sentimentScore || 0), 0) / feedbacksWithSentiment.length
                : null;
              const sentimentLabel = avgSentiment !== null
                ? (avgSentiment > 0.2 ? 'positive' : avgSentiment < -0.2 ? 'negative' : 'neutral')
                : null;
              
              return avgSentiment !== null ? (
                <div>
                  <p className="text-3xl font-bold">
                    {avgSentiment.toFixed(2)}
                  </p>
                  <p className={`text-sm mt-1 ${
                    sentimentLabel === 'positive' ? 'text-green-600' :
                    sentimentLabel === 'negative' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {sentimentLabel}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No sentiment data</p>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Engagement & Attendance Trends</CardTitle>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "Engagement (1-5)",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 12 },
                  }}
                />

                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "Attendance",
                    angle: 90,
                    position: "insideRight",
                    style: { fontSize: 12 },
                  }}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(value: number) => [value.toFixed(1)]}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="engagement"
                  stroke="hsl(var(--primary))"
                  name="Engagement"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="attendance"
                  stroke="hsl(var(--secondary))"
                  name="Attendance"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Last Class Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
                        {loading ? (
              <p className="text-muted-foreground text-center py-4">Loading summary...</p>
            ) : lastClassSummary ? (
              <p className="text-sm">{lastClassSummary}</p>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                No recent class summary available
              </p>
            )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {sortedFeedbacks.map((feedback) => (
                <div key={feedback._id} className="border-b pb-4 last:border-0">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">{feedback.courseCode}</h3>
                      <p className="text-sm text-muted-foreground">
                        {feedback.taName} - {format(new Date(feedback.date), "PPP")}
                        {feedback.semester && feedback.year && (
                          <span className="ml-2 text-xs">({feedback.semester} {feedback.year})</span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2 items-center">
                      {feedback.sentimentLabel && (
                        <span className={`text-xs px-2 py-1 rounded ${
                          feedback.sentimentLabel === 'positive' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : feedback.sentimentLabel === 'negative'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                        }`}>
                          {feedback.sentimentLabel}
                          {feedback.sentimentScore !== undefined && (
                            <span className="ml-1">({feedback.sentimentScore.toFixed(2)})</span>
                          )}
                        </span>
                      )}
                      {feedback.needsAttention && (
                        <span className="bg-primary/10 text-primary text-sm px-2 py-1 rounded">
                          Needs Attention
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteFeedback(feedback._id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm mb-2">
                    <strong>Topics:</strong> {feedback.topicsCovered.join(", ")}
                  </p>
                  <p className="text-sm">
                    <strong>Overview:</strong> {feedback.overview}
                  </p>
                  {feedback.suggestions && (
                    <p className="text-sm mt-2 text-muted-foreground">
                      <strong>Suggestions:</strong> {feedback.suggestions}
                    </p>
                  )}
                </div>
              ))}
              {sortedFeedbacks.length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  No feedback data available for the selected date range
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
