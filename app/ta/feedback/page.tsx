"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AttendanceInput } from "./attendance-input";
import {
  feedbackFormSchema,
  type FeedbackFormData,
  estimateToNumber,
} from "./schema";
import { useRouter } from "next/navigation";
import { getCurrentSemester, getSemesterFromDate } from "@/lib/semester";

//TODO: implement dating so form expires for a class at some point
//TODO: implement scheduled lambda handler to replace all data points with just averages and summaries,EXCEPT urgent matters
export default function TAFeedbackForm() {
  const { toast } = useToast();
  const router = useRouter();

  // Get current semester and year
  const currentSemesterCode = getCurrentSemester();
  const [semester, yearStr] = currentSemesterCode.split(' ');
  const currentYear = parseInt(yearStr);

  // define form with default vals set to Elias and 131 for now
  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      taName: "",
      courseCode: "CMSC131",
      professorName: "Elias Gonzalez",
      semester: semester as "Fall" | "Spring" | "Summer",
      year: currentYear,
      attendanceType: "exact",
      attendanceCount: 0,
      attendanceEstimate: "medium",
      topicsCovered: "",
      studentEngagement: 3,
      overview: "",
      suggestions: "",
      needsAttention: false, //FIXME: urgent matters should persist but expire after some point.
    },
  });

  const attendanceType = form.watch("attendanceType");

  async function onSubmit(values: FeedbackFormData) {
    try {
      const finalAttendanceCount =
        values.attendanceType === "exact"
          ? values.attendanceCount
          : estimateToNumber[
              values.attendanceEstimate as keyof typeof estimateToNumber
            ];

      const submissionData = {
        ...values,
        attendanceCount: finalAttendanceCount,
      };
      // send feedback to db
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submissionData),
      });

      if (!response.ok) throw new Error("Failed to submit feedback");

      // TODO: green check mark on success
      toast({
        title: "Success!",
        description: "Your feedback has been submitted.",
      });

      form.reset(form.getValues());
      router.push("/");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center text-primary hover:text-primary/90 mb-6"
      >
        <ChevronLeft className="h-4 w-4 mr-2" />
        Back to Home
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Submit TA Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="taName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TA Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John Doe"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="courseCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course Code</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select course" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="CMSC131">CMSC131</SelectItem>
                          <SelectItem value="CMSC132">CMSC132</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="professorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Professor Name</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select professor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Elias Gonzalez">
                            Elias Gonzalez
                          </SelectItem>
                          <SelectItem value="Pedram Sadeghian">
                            Pedram Sadeghian
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="semester"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Semester</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select semester" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Fall">Fall</SelectItem>
                          <SelectItem value="Spring">Spring</SelectItem>
                          <SelectItem value="Summer">Summer</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="2024"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || currentYear)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="attendanceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Attendance Input Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select input type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="exact">Exact Count</SelectItem>
                          <SelectItem value="estimate">Estimate</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <AttendanceInput form={form} attendanceType={attendanceType} />

              <FormField
                control={form.control}
                name="topicsCovered"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Topics Covered</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Arrays, Loops, Functions"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="studentEngagement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Student Engagement Level: {field.value}
                    </FormLabel>{" "}
                    <FormControl>
                      <Slider
                        min={1}
                        max={5}
                        step={1}
                        value={[field.value]}
                        onValueChange={(vals: any[]) => field.onChange(vals[0])}
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="overview"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Overview</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what students found challenging, found easy, ..."
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="suggestions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Suggestions (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any suggestions for improvement?"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="needsAttention"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        {"Needs Professor's Attention"}
                      </FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full">
                Submit Feedback
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
